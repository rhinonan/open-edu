'use client';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Input, ListBox, Select, TextArea } from '@heroui/react';
import { Pencil } from 'lucide-react';
import { useEditable } from './editable-context';
import { toast } from '@/lib/toast';

export type EditableType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel';

interface Props {
  value: string | number | null;
  type?: EditableType;
  options?: string[];
  nullOnEmpty?: boolean;
  onSave: (value: string | number | null) => Promise<void>;
  className?: string;
}

const dateInputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-accent focus:outline-none';

export default function EditableCell({ value, type = 'text', options, nullOnEmpty, onSave, className }: Props) {
  const { editable } = useEditable();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (!editable || !editing) {
    const display = value === null || value === '' ? '—' : String(value);
    return (
      <span
        className={`group block w-full rounded px-1 py-0.5 cursor-text ${editable ? 'hover:bg-gray-100' : 'cursor-default'} ${className ?? ''}`}
        title={editable ? '点击编辑' : undefined}
        onClick={() => { if (editable) { setDraft(String(value ?? '')); setEditing(true); } }}
      >
        {display}
        {editable && <Pencil size={11} className="ml-5 inline cursor-pointer text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
      </span>
    );
  }

  const cancel = () => setEditing(false);
  const save = async (v: string | number | null) => {
    setEditing(false);
    if (String(v) === String(value ?? '')) return;
    try { await onSave(v); }
    catch { toast.error('保存失败'); }
  };
  const onBlurSave = () => {
    const final = type === 'number' ? (draft === '' ? 0 : Number(draft)) : (nullOnEmpty && draft === '' ? null : draft);
    void save(final);
  };
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); void save(type === 'number' ? (draft === '' ? 0 : Number(draft)) : draft); }
    if (e.key === 'Escape') cancel();
  };

  if (type === 'select' && options) {
    return (
      <Select
        aria-label="选择"
        className="w-full"
        placeholder="选择"
        selectedKey={value === null || value === '' ? '' : String(value)}
        onSelectionChange={(k) => void save(k === null || k === '' ? null : String(k))}
      >
        <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map(o => <ListBox.Item key={o} id={o}>{o === '' ? '（清空）' : o}</ListBox.Item>)}
          </ListBox>
        </Select.Popover>
      </Select>
    );
  }
  if (type === 'date') {
    return (
      <input
        ref={inputRef}
        type="date"
        autoFocus
        className={dateInputCls}
        defaultValue={String(value ?? '')}
        onBlur={(e) => void save(e.target.value || null)}
      />
    );
  }
  if (type === 'textarea') {
    return (
      <TextArea
        autoFocus rows={2} className="w-full"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => void save(nullOnEmpty && draft === '' ? null : draft)}
        onKeyDown={onKey}
      />
    );
  }
  if (type === 'number') {
    return (
      <Input
        ref={inputRef} autoFocus type="number" className="w-24"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={onBlurSave}
        onKeyDown={onKey}
      />
    );
  }
  return (
    <Input
      ref={inputRef} className="min-w-32"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={onBlurSave}
      onKeyDown={onKey}
    />
  );
}
