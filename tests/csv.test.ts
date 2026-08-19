import { describe, it, expect } from 'vitest';
import { parseCsv, toCsv } from '../lib/csv';

describe('parseCsv', () => {
  it('解析引号内逗号、引号转义、多行', () => {
    const out = parseCsv('a,b\n"x,y",z\n"say ""hi""",w');
    expect(out).toEqual([['a', 'b'], ['x,y', 'z'], ['say "hi"', 'w']]);
  });

  it('去掉 BOM', () => {
    expect(parseCsv(String.fromCharCode(0xFEFF) + 'h1,h2\n1,2')[0][0]).toBe('h1');
  });

  it('兼容 \\r\\n 换行', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('toCsv', () => {
  it('生成带 BOM、带引号的 CSV', () => {
    const csv = toCsv(['学号', '姓名'], [['01', '张,三']]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('学号,姓名');
    expect(csv).toContain('"01","张,三"');
  });
});
