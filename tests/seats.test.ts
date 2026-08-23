import { describe, it, expect } from 'vitest';
import { randomSeatPlan } from '../lib/seats';
import type { Row } from '../lib/types';

function makeStudents(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ name: `学生${i + 1}`, level: (i % 6) + 1 }));
}

describe('randomSeatPlan', () => {
  it('全班学生恰好各就一位，无重复、不超列容量', () => {
    const students = makeStudents(45);
    const { groups, placed } = randomSeatPlan(students, 7, 8);
    const flat = groups.flat();
    expect(placed).toBe(45);
    expect(flat.length).toBe(45);
    expect(new Set(flat).size).toBe(45);
    for (const g of groups) expect(g.length).toBeLessThanOrEqual(7);
  });

  it('座位不足时只安排容量以内的人数', () => {
    const students = makeStudents(45);
    const { groups, placed } = randomSeatPlan(students, 5, 4); // 容量 20
    expect(placed).toBe(20);
    const flat = groups.flat();
    expect(flat.length).toBe(20);
    expect(new Set(flat).size).toBe(20);
  });

  it('48 人、8 列时每个小组恰好拿到 1-6 各一个层级', () => {
    const students = makeStudents(48); // 每个层级 8 人
    const levelOf = new Map(students.map(s => [String(s.name), Number(s.level)]));
    const { groups } = randomSeatPlan(students, 6, 8);
    for (const g of groups) {
      expect(g.length).toBe(6);
      expect(g.map(n => levelOf.get(n)).sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('45 人、8 列时每列 5~6 人，各层级在列间尽量均匀', () => {
    const students = makeStudents(45);
    const levelOf = new Map(students.map(s => [String(s.name), Number(s.level)]));
    const { groups } = randomSeatPlan(students, 7, 8);
    for (const g of groups) {
      expect(g.length).toBeGreaterThanOrEqual(5);
      expect(g.length).toBeLessThanOrEqual(6);
    }
    for (let l = 1; l <= 6; l++) {
      const counts = groups.map(g => g.filter(n => levelOf.get(n) === l).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });
});
