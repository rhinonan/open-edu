'use client';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Checkbox, ListBox, Pagination, Popover, Select, Skeleton, Table } from '@heroui/react';
import type { Selection } from '@heroui/react';
import type { SortDescriptor } from '@heroui/react/rac';
import { FilterX, SlidersHorizontal } from 'lucide-react';
import EditableCell from './editable-cell';
import type { Row } from '@/lib/types';

export type CellType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel';

export interface ColumnDef {
  key: string;
  label: string;
  type?: CellType;
  options?: string[];
  nullOnEmpty?: boolean;
  /** Minimum width (px) for this column's header and cells, so short text
   *  keeps one line and cells don't get squeezed on narrow screens. */
  minWidth?: number;
  /** Keep cell content on a single line (white-space: nowrap). */
  noWrap?: boolean;
  sortable?: boolean;
  sortValue?: (row: Row) => string | number | null;
  filterOptions?: string[];
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: Row) => ReactNode;
}

export interface DataTableProps {
  columns: ColumnDef[];
  rows: Row[];
  loading?: boolean;
  label: string;
  onSave?: (id: number, patch: Partial<Row>) => Promise<void>;
  pageSize?: number;
  actions?: (row: Row) => ReactNode;
  /** 开启复选框列。选中态由页面持有（受控）：勾选行后通过 onSelectionChange 上报。 */
  selectable?: boolean;
  selectedKeys?: Set<number>;
  onSelectionChange?: (keys: Set<number>) => void;
  emptyText?: string;
  /** Minimum width (px) of the <table>. Keeps cells from being squeezed on narrow
   *  screens — the scroll container then scrolls horizontally instead. */
  minWidth?: number;
}

// SortDescriptor requires both `column` and `direction`; an empty string column with
// `ascending` is the "not sorted" sentinel (no real column has key `''`).
const NO_SORT: SortDescriptor = { column: '', direction: 'ascending' };

const compare = (a: string | number | null, b: string | number | null, dir: 'ascending' | 'descending'): number => {
  const na = Number(a); const nb = Number(b);
  const bothNum = a !== null && b !== null && a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb);
  const r = bothNum ? na - nb : String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN');
  return dir === 'ascending' ? r : -r;
};

const fmtCell = (v: unknown): string => (v === null || v === '' ? '—' : String(v));

export default function DataTable({ columns, rows, loading, label, onSave, pageSize, actions, selectable, selectedKeys, onSelectionChange, emptyText, minWidth }: DataTableProps) {
  const [sort, setSort] = useState<SortDescriptor>(NO_SORT);
  const [filters, setFilters] = useState<Record<string, string | null>>({});
  const [page, setPage] = useState(1);

  const renderCols = useMemo<Array<ColumnDef & { key: string }>>(() => {
    let cols: Array<ColumnDef & { key: string }> = columns;
    if (selectable) cols = [{ key: '__selection', label: '', noWrap: true, minWidth: 44, align: 'center' }, ...cols];
    if (actions) cols = [...cols, { key: '__actions', label: '操作' }];
    return cols;
  }, [columns, selectable, actions]);

  const filtered = useMemo(() => {
    let list = rows;
    for (const col of columns) {
      const fv = filters[col.key];
      if (fv != null && col.filterOptions) list = list.filter(r => String(r[col.key]) === fv);
    }
    if (sort.column && sort.direction) {
      const col = columns.find(c => c.key === sort.column);
      if (col) {
        const keyOf = col.sortValue ?? ((r: Row) => r[col.key] as string | number | null);
        list = [...list].sort((a, b) => compare(keyOf(a), keyOf(b), sort.direction!));
      }
    }
    return list;
  }, [rows, columns, filters, sort]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount);
  const visible = pageSize ? filtered.slice((safePage - 1) * pageSize, safePage * pageSize) : filtered;
  const resetPage = () => setPage(1);

  const rowHeaderKey = renderCols.find(c => c.key !== '__selection')?.key;
  const pageIds = visible.map(r => r.id as number);
  const handleSelectionChange = (sel: Selection) => {
    if (!onSelectionChange) return;
    // RAC 的 'all' 表示“全选”，展开成当前页所有行 id
    onSelectionChange(sel === 'all' ? new Set(pageIds) : new Set([...sel].map(Number)));
  };

  const setFilter = (key: string, v: string | null) => {
    setFilters(prev => ({ ...prev, [key]: v }));
    setPage(1);
    onSelectionChange?.(new Set());
  };

  const cell = (col: ColumnDef, r: Row): ReactNode => {
    if (col.key === '__selection') {
      return (
        <Checkbox aria-label="选择本行" slot="selection">
          <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
        </Checkbox>
      );
    }
    if (col.key === '__actions') return actions!(r);
    if (col.render) return col.render(r[col.key], r);
    if (col.type && onSave) {
      return (
        <EditableCell
          value={r[col.key] as string | number | null}
          type={col.type}
          options={col.options}
          nullOnEmpty={col.nullOnEmpty}
          onSave={v => onSave(Number(r.id), { [col.key]: v })}
        />
      );
    }
    return <span>{fmtCell(r[col.key])}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Table.Root className="min-h-0 min-w-0 flex-1 grid-rows-1">
        <Table.ScrollContainer className="min-h-0 min-w-0 overflow-y-auto">
          <Table.Content
            aria-label={label}
            sortDescriptor={sort}
            onSortChange={(d) => { setSort(d); resetPage(); }}
            selectionMode={selectable ? 'multiple' : undefined}
            selectedKeys={selectable ? (selectedKeys as unknown as Selection) : undefined}
            onSelectionChange={selectable ? handleSelectionChange : undefined}
            style={minWidth ? { minWidth } : undefined}
          >
          <Table.Header columns={renderCols}>
            {(col: ColumnDef & { key: string }) => (
              <Table.Column
                key={col.key}
                id={col.key}
                allowsSorting={col.sortable}
                isRowHeader={col.key === rowHeaderKey}
                style={{ minWidth: col.minWidth }}
              >
                {({ sortDirection }: { sortDirection?: 'ascending' | 'descending' }) =>
                  col.key === '__selection' ? (
                    <Checkbox aria-label="全选" slot="selection">
                      <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
                    </Checkbox>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {col.sortable ? (
                        <Table.SortableColumnHeader sortDirection={sortDirection}>{col.label}</Table.SortableColumnHeader>
                      ) : (
                        <span>{col.label}</span>
                      )}
                      {col.filterOptions && (
                        <ColumnFilter col={col} value={filters[col.key] ?? null} onChange={setFilter} />
                      )}
                    </div>
                  )
                }
              </Table.Column>
            )}
          </Table.Header>
          <Table.Body
            items={visible}
            renderEmptyState={() => (
              <div className="py-12 text-center text-sm text-slate-400">{emptyText ?? '暂无数据'}</div>
            )}
          >
            {(item: Row) => (
              <Table.Row id={(item.id as number) ?? item.id}>
                {renderCols.map(col => (
                  <Table.Cell
                    key={col.key}
                    className={[
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left',
                      col.noWrap ? 'whitespace-nowrap' : '',
                    ].filter(Boolean).join(' ')}
                    style={{ minWidth: col.minWidth }}
                  >
                    {cell(col, item)}
                  </Table.Cell>
                ))}
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
        </Table.ScrollContainer>
      </Table.Root>
      {pageSize && pageCount > 1 && (
        <Pagination.Root size="sm" className="mt-3 flex shrink-0 justify-end">
          <Pagination.Content>
            <Pagination.Item><Pagination.Previous onPress={() => setPage(p => Math.max(1, p - 1))}><Pagination.PreviousIcon /></Pagination.Previous></Pagination.Item>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => (
              <Pagination.Item key={p}>
                <Pagination.Link isActive={p === safePage} onPress={() => setPage(p)}>{p}</Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item><Pagination.Next onPress={() => setPage(p => Math.min(pageCount, p + 1))}><Pagination.NextIcon /></Pagination.Next></Pagination.Item>
          </Pagination.Content>
        </Pagination.Root>
      )}
    </div>
  );
}

function ColumnFilter({ col, value, onChange }: { col: ColumnDef; value: string | null; onChange: (key: string, v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <button
          type="button"
          aria-label={`筛选${col.label}`}
          onClick={(e) => e.stopPropagation()}
          className={`rounded p-0.5 ${value ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}
        >
          {value ? <FilterX size={14} /> : <SlidersHorizontal size={14} />}
        </button>
      </Popover.Trigger>
      <Popover.Content placement="bottom">
        <div className="w-44 p-2">
          <Select
            aria-label={`筛选${col.label}`}
            fullWidth
            placeholder="全部"
            selectedKey={value ?? ''}
            onSelectionChange={(k) => onChange(col.key, k === null || k === '' ? null : String(k))}
          >
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="" textValue="全部">全部</ListBox.Item>
                {(col.filterOptions ?? []).map(o => <ListBox.Item key={o} id={o} textValue={o}>{o}</ListBox.Item>)}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </Popover.Content>
    </Popover>
  );
}
