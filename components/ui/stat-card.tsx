import type { StatDef } from '../crud/types';

const TONE: Record<string, string> = {
  blue: 'border-blue-200 text-blue-700',
  teal: 'border-teal-200 text-teal-700',
  purple: 'border-purple-200 text-purple-700',
  amber: 'border-amber-200 text-amber-700',
  red: 'border-red-200 text-red-700',
  default: 'border-slate-200 text-slate-700',
};

export function StatCard({ label, value, tone = 'default' }: StatDef) {
  return (
    <div className={`card px-4 py-3 border-l-4 ${TONE[tone] ?? TONE.default}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

export function StatRow({ stats }: { stats: StatDef[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
      {stats.map((s, i) => <StatCard key={i} {...s} />)}
    </div>
  );
}
