import type { Row } from './types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface SeatPlan {
  /** groups[c][r] = 第 c 列、第 r 排的姓名（竖排为一个小组） */
  groups: string[][];
  placed: number;
}

/**
 * 按规则随机排座：竖排为一个小组。
 * 把学生按层级排序后轮流发给各列，让每个小组尽量均衡地覆盖 1~6 各层级；
 * 小组人数超过 6 出现的多余位置，层级随层级余量自然随机。每列内部再打乱，
 * 避免全列清一色排成固定的层序。容量不足时随机截取，只安排能坐下的人数。
 */
export function randomSeatPlan(students: Row[], rowCount: number, colCount: number): SeatPlan {
  const capacity = rowCount * colCount;
  const chosen = shuffle(students)
    .slice(0, Math.min(students.length, capacity))
    .sort((a, b) => (Number(a.level) || 1) - (Number(b.level) || 1));

  const cols = shuffle(Array.from({ length: colCount }, (_, i) => i));
  const groups: string[][] = Array.from({ length: colCount }, () => []);
  for (let i = 0; i < chosen.length; i++) {
    const c = cols[i % colCount];
    if (groups[c].length < rowCount) {
      groups[c].push(String(chosen[i].name));
    } else {
      // 该列已满（容量边界情况），找任意有空位的列
      for (let cc = 0; cc < colCount; cc++) {
        if (groups[cc].length < rowCount) { groups[cc].push(String(chosen[i].name)); break; }
      }
    }
  }

  return { groups: groups.map(g => shuffle(g)), placed: chosen.length };
}
