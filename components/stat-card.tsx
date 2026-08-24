export default function StatCard({ title, value, suffix, className }: {
  title: string;
  value: string | number;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white px-4 py-3 ${className ?? ''}`}>
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-semibold text-slate-800">
        {value}
        {suffix ? <span className="ml-1 text-xs font-normal text-slate-400">{suffix}</span> : null}
      </div>
    </div>
  );
}
