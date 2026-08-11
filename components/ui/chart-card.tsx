import { ReactNode } from 'react';

export default function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-slate-600 mb-3">{title}</h3>
      <div className="h-56">{children}</div>
    </div>
  );
}
