import { describe, it, expect } from 'vitest';
import { maskSensitive } from '../lib/sensitive';

describe('maskSensitive', () => {
  it('手机号掩码保留首 3 尾 4', () => {
    expect(maskSensitive('13812345678', 'phone')).toBe('138****5678');
  });

  it('18 位身份证掩码保留前 6 后 4', () => {
    expect(maskSensitive('430102201509120011', 'idcard')).toBe('430102********0011');
  });

  it('15 位身份证兼容', () => {
    expect(maskSensitive('430102991231001', 'idcard')).toBe('430102******001');
  });

  it('末位为 X 的身份证', () => {
    expect(maskSensitive('43010220150912001X', 'idcard')).toBe('430102********001X');
  });

  it('空值返回空字符串', () => {
    expect(maskSensitive('', 'phone')).toBe('');
    expect(maskSensitive('   ', 'phone')).toBe('');
  });

  it('格式不匹配时退回通用掩码', () => {
    expect(maskSensitive('0731-88888888', 'phone')).toBe('073****8888');
    expect(maskSensitive('123456', 'phone')).toBe('12**56');
  });
});
