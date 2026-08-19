'use client';
import { useState } from 'react';
import { parseCsv, toCsv } from '@/lib/csv';
import { post } from '@/lib/api-client';
import type { ImportItem } from '@/lib/import';
import type { ImportTemplate } from './types';
import Modal from '../ui/modal';

interface Result { created: number; updated: number; skipped: number; errors: { row: number; message: string }[] }

interface Props {
  resource: string;
  template: ImportTemplate;
  onClose: () => void;
  onDone: () => void;
}

export default function ImportModal({ resource, template, onClose, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const downloadTemplate = () => {
    const headers = template.columns.map(c => c.label);
    const example = template.columns.map(c => template.exampleRow[c.key] ?? '');
    const csv = toCsv(headers, [example]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = template.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const text = await file.text();
      const table = parseCsv(text);
      if (table.length < 2) { setError('文件为空或只有表头'); return; }
      const headerIdx = new Map(table[0].map((h, i) => [h.trim(), i]));
      const items: ImportItem[] = [];
      const skipped: { row: number; message: string }[] = [];
      for (let i = 1; i < table.length; i++) {
        const fields: Record<string, string> = {};
        template.columns.forEach(c => {
          const idx = headerIdx.get(c.label);
          fields[c.key] = idx === undefined ? '' : (table[i][idx] ?? '').trim();
        });
        const parsed = template.parseRow(fields, i + 1);
        if (parsed.ok) items.push(parsed.row);
        else skipped.push({ row: i + 1, message: parsed.message });
      }
      const server = await post<Result>(`/api/${resource}/import`, { rows: items });
      setResult({
        created: server.created,
        updated: server.updated,
        skipped: server.skipped + skipped.length,
        errors: [...server.errors, ...skipped],
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="导入" open onClose={onClose}>
      <p className="text-xs text-slate-500 mb-3">按身份证匹配：已存在的身份证覆盖，新的新增；无身份证的行跳过。</p>
      <button className="btn-primary px-3 py-1.5 text-xs mb-3" onClick={downloadTemplate}>下载示例模板</button>
      {!result ? (
        <div>
          <input type="file" accept=".csv" onChange={handleFile} disabled={busy} className="text-xs" />
          {busy && <p className="text-xs text-slate-400 mt-2">导入中…</p>}
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      ) : (
        <div className="text-sm">
          <p className="mb-2">新增 {result.created} · 更新 {result.updated} · 跳过 {result.skipped}</p>
          {result.errors.length > 0 && (
            <ul className="text-xs text-amber-600 space-y-1 max-h-32 overflow-y-auto">
              {result.errors.map((er, idx) => (
                <li key={idx}>第 {er.row} 行：{er.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <button className="bg-white border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors px-4 py-1.5 text-sm" onClick={onClose}>完成</button>
      </div>
    </Modal>
  );
}
