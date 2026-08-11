import type { Row } from './types';
import type { ColumnDef } from '@/components/crud/types';

export function exportCsv(rows: Row[], columns: ColumnDef[], filename: string): void {
  columns = columns.filter(c => !c.render && !c.readOnly);
  const head = columns.map(c => c.label).join(',');
  const lines = rows.map(r => columns.map(c => {
    const v = String(r[c.key] ?? '');
    return `"${v.replace(/"/g, '""')}"`;
  }).join(','));
  const blob = new Blob(['﻿' + [head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
