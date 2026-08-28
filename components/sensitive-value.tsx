'use client';
import { useState } from 'react';
import { Copy, Eye, EyeOff, Pencil } from 'lucide-react';
import { toast } from '@/lib/toast';
import { maskSensitive, type SensitiveKind } from '@/lib/sensitive';
import HoverIconButton from './hover-icon-button';
import { cellEditorBase } from './cell-editors';

interface SensitiveValueProps {
  value: unknown;
  kind?: SensitiveKind;
  className?: string;
  /** 提供后显示编辑图标，点击进入行内编辑（回车 / 失焦保存，Esc 取消） */
  onSave?: (value: string) => void | Promise<void>;
}

/** 敏感号码单元格：默认掩码，眼睛图标切换明文/掩码，复制图标复制完整号码；
 *  传入 onSave 时额外提供编辑图标，点击进入行内编辑。
 *  图标统一悬浮显示（触屏设备始终显示，因为无悬浮）。 */
export default function SensitiveValue({ value, kind = 'phone', className, onSave }: SensitiveValueProps) {
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const text = value === null || value === undefined || value === '' ? '' : String(value);
  const display = text ? (revealed ? text : maskSensitive(text, kind)) : '—';

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制');
    } catch {
      toast.error('复制失败');
    }
  };

  const startEdit = () => {
    setDraft(text);
    setRevealed(false);
    setEditing(true);
  };

  const commit = async () => {
    setEditing(false);
    if (draft === text) return;
    try {
      await onSave?.(draft);
    } catch {
      toast.error('保存失败');
    }
  };

  if (editing) {
    return (
      <span className={`group inline-flex items-center gap-1 whitespace-nowrap ${className ?? ''}`}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter') void commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={() => void commit()}
          className={`${cellEditorBase} ${kind === 'idcard' ? 'w-44' : 'w-32'}`}
        />
      </span>
    );
  }

  return (
    <span className={`group inline-flex items-center gap-1 whitespace-nowrap ${className ?? ''}`}>
      <span>{display}</span>
      {text && (
        <>
          <HoverIconButton label={revealed ? '隐藏' : '显示'} onClick={() => setRevealed(r => !r)}>
            {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
          </HoverIconButton>
          <HoverIconButton label="复制" onClick={() => void copy()}>
            <Copy size={13} />
          </HoverIconButton>
        </>
      )}
      {onSave && (
        <HoverIconButton label="编辑" onClick={startEdit}>
          <Pencil size={13} />
        </HoverIconButton>
      )}
    </span>
  );
}
