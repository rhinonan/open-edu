'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface HoverIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 无障碍标签，同时作为悬浮提示（title） */
  label: string;
  children: ReactNode;
}

/** 悬浮显示的图标小按钮：布局和样式与学生列表电话/身份证单元格的显示、复制图标一致。
 *  默认淡出，所在容器 group 悬浮（或触屏设备）时淡入。 */
export default function HoverIconButton({ label, children, className, ...rest }: HoverIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      className={`rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-slate-600 group-hover:opacity-100 pointer-coarse:opacity-100 ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}
