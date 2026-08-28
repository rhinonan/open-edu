'use client';
import { useEffect, useState } from 'react';
import { Button, Checkbox, Popover } from '@heroui/react';
import { Columns3, Download, Plus, Upload } from 'lucide-react';
import type { Row } from '@/lib/types';
import { downloadCsv } from '@/lib/csv';

export function useColumnVisibility(storageKey: string, defaultHidden: string[] = []) {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (Array.isArray(v)) return new Set(v);
    } catch { /* localStorage 不可用 */ }
    return new Set(defaultHidden);
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...hidden])); } catch { /* ignore */ }
  }, [hidden, storageKey]);
  return {
    hidden,
    toggle: (key: string) => setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    }),
  };
}

export interface ToolbarColumn { key: string; label: string; exportable?: boolean; }

interface Props {
  title: string;
  columns: ToolbarColumn[];
  hidden: Set<string>;
  onToggleColumn: (key: string) => void;
  rows: Row[];
  onAdd?: () => void;
  onImport?: () => void;
  /** 勾选的行 id；非空时显示「导出选中 / 删除选中」。 */
  selectedKeys?: Set<number>;
  onBatchDelete?: () => void;
}

export default function TableToolbar({ title, columns, hidden, onToggleColumn, rows, onAdd, onImport, selectedKeys, onBatchDelete }: Props) {
  const [colOpen, setColOpen] = useState(false);

  const exportable = columns.filter(c => (c.exportable ?? true) && !hidden.has(c.key));
  const selectedRows = rows.filter(r => selectedKeys?.has(r.id as number) ?? false);
  const exportCsv = () => {
    downloadCsv(`${title}.csv`, exportable.map(c => c.label), rows.map(r => exportable.map(c => r[c.key] ?? '')));
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="m-0 text-lg font-semibold text-slate-800">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {onImport && (
          <Button variant="outline" size="sm" onPress={onImport}>
            <Upload size={16} /> 导入
          </Button>
        )}
        <Button variant="outline" size="sm" onPress={exportCsv}>
          <Download size={16} /> 导出
        </Button>
        <Popover isOpen={colOpen} onOpenChange={setColOpen}>
          <Popover.Trigger>
            <Button variant="outline" size="sm">
              <Columns3 size={16} /> 列
            </Button>
          </Popover.Trigger>
          <Popover.Content placement="bottom end">
            <div className="w-44 p-2">
              {columns.map(c => (
                <label key={c.key} className="flex items-center gap-2 px-1 py-1 text-sm text-slate-700">
                  <Checkbox isSelected={!hidden.has(c.key)} onChange={() => onToggleColumn(c.key)}>
                    {c.label}
                  </Checkbox>
                </label>
              ))}
            </div>
          </Popover.Content>
        </Popover>
        {onAdd && (
          <Button variant="primary" size="sm" onPress={onAdd}>
            <Plus size={16} /> 新增
          </Button>
        )}
        {selectedKeys && selectedKeys.size > 0 && (
          <>
            <Button variant="outline" size="sm" onPress={() => downloadCsv(`${title}.csv`, exportable.map(c => c.label), selectedRows.map(r => exportable.map(c => r[c.key] ?? '')))}>
              导出选中
            </Button>
            <Button variant="danger-soft" size="sm" onPress={onBatchDelete}>
              删除选中({selectedKeys.size})
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
