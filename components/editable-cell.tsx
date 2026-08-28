'use client';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Pencil } from 'lucide-react';
import HoverIconButton from './hover-icon-button';
import { CellInput, CellSelect, CellTextarea } from './cell-editors';
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

/** 可编辑单元格：显示态与电话/身份证一致（悬浮显示编辑图标，点击图标进入编辑），
 *  编辑态用紧凑输入控件，避免切换时表格抖动。 */
export default function EditableCell({ value, type = 'text', options, nullOnEmpty, onSave, className }: Props) {
  const { editable } = useEditable();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (!editable || !editing) {
    const display = value === null || value === '' ? '—' : String(value);
    return (
      <span className={`group inline-flex w-full items-center gap-1 ${className ?? ''}`}>
        <span>{display}</span>
        {editable && (
          <HoverIconButton label="编辑" onClick={() => { setDraft(String(value ?? '')); setEditing(true); }}>
            <Pencil size={13} />
          </HoverIconButton>
        )}
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
      <CellSelect
        autoFocus
        options={options}
        value={value === null || value === '' ? '' : String(value)}
        onCommit={k => void save(k)}
      />
    );
  }
  if (type === 'date') {
    return (
      <CellInput
        ref={inputRef}
        type="date"
        autoFocus
        defaultValue={String(value ?? '')}
        onBlur={e => void save(e.target.value || null)}
      />
    );
  }
  if (type === 'textarea') {
    return (
      <CellTextarea
        autoFocus rows={2}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => void save(nullOnEmpty && draft === '' ? null : draft)}
        onKeyDown={onKey}
      />
    );
  }
  if (type === 'number') {
    return (
      <CellInput
        ref={inputRef} autoFocus type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={onBlurSave}
        onKeyDown={onKey}
      />
    );
  }
  return (
    <CellInput
      ref={inputRef} autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={onBlurSave}
      onKeyDown={onKey}
    />
  );
}
