import { Chip } from '@heroui/react';

export interface StatChip { text: string; color?: 'default' | 'success' | 'danger' | 'warning' | 'accent' }

export default function StatCard({ title, value, suffix, chip, className }: {
  title: string;
  value: string | number;
  suffix?: string;
  chip?: StatChip;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-surface p-5 shadow-surface ${className ?? ''}`}>
      <div className="text-sm text-muted">{title}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        {chip ? (
          <Chip color={chip.color ?? 'default'} size="sm" variant="soft">{chip.text}</Chip>
        ) : suffix ? (
          <span className="text-xs font-medium text-muted">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}
