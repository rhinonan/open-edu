'use client';
import { useState } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/lib/toast';
import { maskSensitive, type SensitiveKind } from '@/lib/sensitive';

interface SensitiveValueProps {
  value: unknown;
  kind?: SensitiveKind;
  className?: string;
}

/** 敏感号码单元格：默认掩码，眼睛图标切换明文/掩码，复制图标复制完整号码。
 *  两个图标悬浮时显示（触屏设备始终显示，因为无悬浮）。 */
export default function SensitiveValue({ value, kind = 'phone', className }: SensitiveValueProps) {
  const [revealed, setRevealed] = useState(false);
  const text = value === null || value === undefined || value === '' ? '' : String(value);
  const display = revealed ? text : maskSensitive(text, kind);

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制');
    } catch {
      toast.error('复制失败');
    }
  };

  if (!text) return <span className={className}>—</span>;

  const iconCls =
    'rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-slate-600 group-hover:opacity-100 pointer-coarse:opacity-100';

  return (
    <span className={`group inline-flex items-center gap-1 whitespace-nowrap ${className ?? ''}`}>
      <span>{display}</span>
      <button
        type="button"
        aria-label={revealed ? '隐藏' : '显示'}
        title={revealed ? '隐藏' : '显示'}
        onClick={() => setRevealed(r => !r)}
        className={iconCls}
      >
        {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button
        type="button"
        aria-label="复制"
        title="复制"
        onClick={() => void copy()}
        className={iconCls}
      >
        <Copy size={13} />
      </button>
    </span>
  );
}
