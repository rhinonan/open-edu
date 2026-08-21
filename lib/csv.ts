import type { Row } from './types';

export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n') {
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = headers.join(',');
  const body = rows.map(r => r.map(c => esc(String(c))).join(','));
  return String.fromCharCode(0xFEFF) + [head, ...body].join('\n');
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
