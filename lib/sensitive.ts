export type SensitiveKind = 'phone' | 'idcard';

/** 掩码号码中间部分，用于表格中展示手机号 / 身份证号。
 *  手机号：138****0000（保留首 3 尾 4）；
 *  身份证：430102********0011（保留前 6 后 4，兼容 15 位老证 430102******001）。
 *  格式不匹配时退回通用掩码（保留首 3 尾 4）。 */
export function maskSensitive(value: string, kind: SensitiveKind = 'phone'): string {
  const s = value.trim();
  if (!s) return '';
  if (kind === 'phone') {
    if (/^\d{11}$/.test(s)) return `${s.slice(0, 3)}****${s.slice(-4)}`;
  } else {
    if (/^\d{17}[\dXx]$/.test(s)) return `${s.slice(0, 6)}********${s.slice(-4)}`;
    if (/^\d{15}$/.test(s)) return `${s.slice(0, 6)}******${s.slice(-3)}`;
  }
  if (s.length >= 8) return `${s.slice(0, 3)}****${s.slice(-4)}`;
  if (s.length >= 5) return `${s.slice(0, 2)}**${s.slice(-2)}`;
  return s;
}
