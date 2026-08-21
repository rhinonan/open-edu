'use client';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { App, DatePicker, Input, InputNumber, Select } from 'antd';
import type { InputRef } from 'antd';
import dayjs from 'dayjs';
import { useEditable } from './editable-context';

export type EditableType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel';

interface Props {
  value: string | number | null;
  type?: EditableType;
  options?: string[];
  nullOnEmpty?: boolean;
  onSave: (value: string | number | null) => Promise<void>;
  className?: string;
}

export default function EditableCell({ value, type = 'text', options, nullOnEmpty, onSave, className }: Props) {
  const { editable } = useEditable();
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value ?? ''));
  const inputRef = useRef<InputRef>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (!editable || !editing) {
    const display = value === null || value === '' ? '—' : String(value);
    return (
      <span
        className={`block w-full px-1 py-0.5 rounded cursor-text ${editable ? 'hover:bg-gray-100' : 'cursor-default hover:bg-transparent'} ${className ?? ''}`}
        title={editable ? '点击编辑' : undefined}
        onClick={() => { if (editable) { setDraft(String(value ?? '')); setEditing(true); } }}
      >
        {display}
      </span>
    );
  }

  const cancel = () => setEditing(false);
  const save = async (v: string | number | null) => {
    setEditing(false);
    if (String(v) === String(value ?? '')) return;
    try { await onSave(v); }
    catch { message.error('保存失败'); }
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
        size="small" autoFocus open style={{ width: '100%' }}
        defaultValue={value ?? ''}
        options={options.map(o => ({ value: o, label: o }))}
        onChange={(v) => void save(v)}
      />
    );
  }
  if (type === 'date') {
    return (
      <DatePicker
        size="small" autoFocus style={{ width: '100%' }}
        value={value ? dayjs(String(value)) : null}
        onChange={(d) => void save(d ? d.format('YYYY-MM-DD') : '')}
      />
    );
  }
  if (type === 'textarea') {
    return (
      <Input.TextArea
        autoFocus rows={2} size="small" value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => void save(nullOnEmpty && draft === '' ? null : draft)}
        onKeyDown={onKey}
      />
    );
  }
  if (type === 'number') {
    return (
      <InputNumber
        autoFocus size="small" style={{ width: '100%' }}
        value={draft === '' ? null : Number(draft)}
        onChange={(v) => setDraft(v === null ? '' : String(v))}
        onBlur={onBlurSave}
        onPressEnter={() => void save(draft === '' ? 0 : Number(draft))}
      />
    );
  }
  return (
    <Input
      ref={inputRef} size="small" variant="borderless" value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={onBlurSave}
      onKeyDown={onKey}
    />
  );
}
