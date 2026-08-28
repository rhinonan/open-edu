'use client';
import type { ComponentProps } from 'react';

/** 行内编辑控件的基础样式：紧凑尺寸，与电话/身份证的编辑输入框一致 */
export const cellEditorBase =
  'min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-accent focus:outline-none';

/** 普通单元格的编辑控件：填满单元格，切换编辑时表格不因宽度变化而抖动 */
export const cellEditorCls = `${cellEditorBase} w-full`;

export function CellInput({ className, onPointerDown, ...rest }: ComponentProps<'input'>) {
  return <input className={`${cellEditorCls} ${className ?? ''}`} onPointerDown={onPointerDown ?? ((e) => e.stopPropagation())} {...rest} />;
}

export function CellTextarea({ className, onPointerDown, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={`${cellEditorCls} resize-none ${className ?? ''}`} onPointerDown={onPointerDown ?? ((e) => e.stopPropagation())} {...rest} />;
}

interface CellSelectProps extends Omit<ComponentProps<'select'>, 'value' | 'onChange'> {
  value: string;
  options: string[];
  onCommit: (v: string | null) => void;
}

/** 紧凑下拉框：样式与编辑输入框一致，含「（清空）」项 */
export function CellSelect({ value, options, onCommit, className, onPointerDown, ...rest }: CellSelectProps) {
  return (
    <select
      className={`${cellEditorCls} cursor-pointer ${className ?? ''}`}
      value={value}
      onChange={e => onCommit(e.target.value === '' ? null : e.target.value)}
      onPointerDown={onPointerDown ?? ((e) => e.stopPropagation())}
      {...rest}
    >
      <option value="">（清空）</option>
      {options.map(o => <option key={o} value={o}>{o === '' ? '（清空）' : o}</option>)}
    </select>
  );
}
