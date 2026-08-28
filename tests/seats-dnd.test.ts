import { describe, it, expect } from 'vitest';
import { planSeatDrag, changesToOps, buildSeatIdMap } from '../lib/seats-dnd';
import type { Row } from '../lib/types';

function seat(id: number, r: number, c: number, name: string): Row {
  return { id, row_index: r, col_index: c, student_name: name };
}

describe('planSeatDrag', () => {
  it('池 → 空格：落座，next 生成临时行，写库为 POST', () => {
    const seats: Row[] = [seat(1, 0, 1, '李雷')];
    const res = planSeatDrag(seats, { kind: 'pool', name: '张三' }, { type: 'cell', row: 0, col: 0 });
    expect(res.changes).toEqual([{ row: 0, col: 0, student_name: '张三' }]);
    const temp = res.next.find(n => Number(n.row_index) === 0 && Number(n.col_index) === 0)!;
    expect(Number(temp.id)).toBeLessThanOrEqual(0);
    expect(temp.student_name).toBe('张三');
    const ops = changesToOps(res.changes, buildSeatIdMap(res.next));
    expect(ops).toEqual([{ kind: 'post', row: 0, col: 0, student_name: '张三' }]);
  });

  it('池 → 已占格：替换，原学生不再出现在座位表（回池），写库为 PUT', () => {
    const seats = [seat(1, 0, 0, '李雷'), seat(2, 0, 1, '韩梅')];
    const res = planSeatDrag(seats, { kind: 'pool', name: '张三' }, { type: 'cell', row: 0, col: 0 });
    expect(res.changes).toEqual([{ row: 0, col: 0, student_name: '张三' }]);
    expect(res.next.some(n => n.student_name === '李雷')).toBe(false);
    const ops = changesToOps(res.changes, buildSeatIdMap(res.next));
    expect(ops).toEqual([{ kind: 'put', id: 1, row: 0, col: 0, student_name: '张三' }]);
  });

  it('座位 → 空格：移动，源清空、目标填入，两处均 PUT', () => {
    const seats = [seat(1, 0, 0, '李雷'), seat(2, 0, 1, '')];
    const res = planSeatDrag(seats, { kind: 'seat', name: '李雷', seatId: 1, row: 0, col: 0 }, { type: 'cell', row: 0, col: 1 });
    expect(res.changes).toEqual([
      { row: 0, col: 0, student_name: '' },
      { row: 0, col: 1, student_name: '李雷' },
    ]);
    const ops = changesToOps(res.changes, buildSeatIdMap(res.next));
    expect(ops).toEqual([
      { kind: 'put', id: 1, row: 0, col: 0, student_name: '' },
      { kind: 'put', id: 2, row: 0, col: 1, student_name: '李雷' },
    ]);
  });

  it('座位 → 已占格：互换，两处姓名对调', () => {
    const seats = [seat(1, 0, 0, '李雷'), seat(2, 0, 1, '韩梅')];
    const res = planSeatDrag(seats, { kind: 'seat', name: '李雷', seatId: 1, row: 0, col: 0 }, { type: 'cell', row: 0, col: 1 });
    expect(res.changes).toEqual([
      { row: 0, col: 0, student_name: '韩梅' },
      { row: 0, col: 1, student_name: '李雷' },
    ]);
    const ops = changesToOps(res.changes, buildSeatIdMap(res.next));
    expect(ops).toEqual([
      { kind: 'put', id: 1, row: 0, col: 0, student_name: '韩梅' },
      { kind: 'put', id: 2, row: 0, col: 1, student_name: '李雷' },
    ]);
  });

  it('座位 → 池：清空该座位，写库为 PUT 空串', () => {
    const seats = [seat(1, 0, 0, '李雷')];
    const res = planSeatDrag(seats, { kind: 'seat', name: '李雷', seatId: 1, row: 0, col: 0 }, { type: 'pool' });
    expect(res.changes).toEqual([{ row: 0, col: 0, student_name: '' }]);
    const ops = changesToOps(res.changes, buildSeatIdMap(res.next));
    expect(ops).toEqual([{ kind: 'put', id: 1, row: 0, col: 0, student_name: '' }]);
  });

  it('拖回同一格：no-op', () => {
    const seats = [seat(1, 0, 0, '李雷')];
    const res = planSeatDrag(seats, { kind: 'seat', name: '李雷', seatId: 1, row: 0, col: 0 }, { type: 'cell', row: 0, col: 0 });
    expect(res.changes).toEqual([]);
  });

  it('临时行被清空后从 next 移除；写库只对无 id 非空处 POST', () => {
    const seats = [seat(1, 0, 1, '韩梅')];
    const drop1 = planSeatDrag(seats, { kind: 'pool', name: '张三' }, { type: 'cell', row: 0, col: 0 });
    const drop2 = planSeatDrag(
      drop1.next,
      { kind: 'seat', name: '张三', seatId: -1, row: 0, col: 0 },
      { type: 'cell', row: 1, col: 1 },
    );
    expect(drop2.next.some(n => Number(n.row_index) === 0 && Number(n.col_index) === 0)).toBe(false);
    const ops = changesToOps(drop2.changes, buildSeatIdMap(drop2.next));
    expect(ops).toEqual([{ kind: 'post', row: 1, col: 1, student_name: '张三' }]);
  });
});

describe('changesToOps', () => {
  it('空名且无真实 id 时跳过（服务端无需动作）', () => {
    expect(changesToOps([{ row: 0, col: 5, student_name: '' }], new Map())).toEqual([]);
  });
});

describe('buildSeatIdMap', () => {
  it('只收录真实 id（id > 0）的行', () => {
    const seats = [seat(1, 0, 0, 'a'), seat(-2, 0, 1, 'b'), seat(3, 1, 1, 'c')];
    const ids = buildSeatIdMap(seats);
    expect(ids.get('0-0')).toBe(1);
    expect(ids.get('0-1')).toBeUndefined();
    expect(ids.get('1-1')).toBe(3);
  });
});
