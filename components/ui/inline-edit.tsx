'use client';
import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useEditable } from '../editable-context';
import { useToast } from './toast';
import type { FieldType } from '../crud/types';

interface Props {
  value: string | number | null;
  type?: FieldType;
  options?: string[];
  onSave: (value: string | number) => Promise<void>;
  className?: string;
}

export default function InlineEdit({ value, type = 'text', options, onSave, className }: Props) {
  const { editable } = useEditable();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editable || !editing) {
    const display = value === null || value === '' ? '—' : String(value);
    return (
      <div
        className={`min-h-[1.5rem] px-1 py-0.5 rounded hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 cursor-text ${className ?? ''} ${editable ? '' : 'cursor-default hover:bg-transparent hover:ring-0'}`}
        onClick={() => { if (editable) { setDraft(String(value ?? '')); setEditing(true); } }}
        title={editable ? '点击编辑' : undefined}
      >
        {display}
      </div>
    );
  }

  const cancel = () => setEditing(false);
  const save = async () => {
    const parsed: string | number = type === 'number' ? (draft === '' ? 0 : Number(draft)) : draft;
    setEditing(false);
    if (String(parsed) === String(value ?? '')) return;
    try { await onSave(parsed); toast('已保存'); }
    catch { toast('保存失败', 'err'); }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); save(); }
    if (e.key === 'Escape') cancel();
  };

  const base = 'w-full px-1 py-0.5 rounded border border-accent outline-none text-sm';
  if (type === 'select' && options) {
    return (
      <select ref={inputRef as never} className={base} value={String(value ?? '')} onChange={e => { setDraft(e.target.value); }} onBlur={save}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (type === 'textarea') {
    return (
      <textarea ref={inputRef as never} className={`${base} resize-y`} value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={save} rows={2} />
    );
  }
  return (
    <input ref={inputRef as never} type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      className={base} value={draft} onChange={e => setDraft(e.target.value)} onBlur={save} onKeyDown={onKey} />
  );
}
