export default function EmptyState({ text = '暂无数据' }: { text?: string }) {
  return <div className="py-10 text-center text-sm text-slate-400">{text}</div>;
}
