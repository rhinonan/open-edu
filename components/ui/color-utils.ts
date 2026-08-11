const MAP: Record<string, string> = {
  '语文': '#3b82f6',
  '数学': '#8b5cf6',
  '英语': '#14b8a6',
  '科学': '#f59e0b',
  '体育': '#ef4444',
  '音乐': '#eab308',
  '美术': '#ec4899',
  '班级管理': '#3b82f6',
  '教学教研': '#8b5cf6',
  '家校沟通': '#f59e0b',
  '学生培优': '#ef4444',
  '生涯活动': '#14b8a6',
  '安全教育': '#eab308',
  '会议培训': '#6366f1',
  '心理辅导': '#ec4899',
  '备课': '#3b82f6',
  '教研': '#8b5cf6',
  '培优': '#ef4444',
  '监考': '#f59e0b',
  '会议': '#14b8a6',
};

export function CategoryColor(kind: string): string {
  return MAP[kind] ?? '#64748b';
}
