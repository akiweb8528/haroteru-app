import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
} from './utils';

// 環境によって円記号が ¥(U+00A5) または ￥(U+FFE5) になるため
// 実際の Intl.NumberFormat 出力と比較する
const toJPY = (n: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(n);

describe('formatCurrency', () => {
  it('整数の円金額を日本円形式にフォーマットする', () => {
    expect(formatCurrency(1000)).toBe(toJPY(1000));
  });

  it('0円をフォーマットする', () => {
    expect(formatCurrency(0)).toBe(toJPY(0));
  });

  it('大きな金額を3桁区切りでフォーマットする', () => {
    expect(formatCurrency(1000000)).toBe(toJPY(1000000));
    expect(formatCurrency(1000000)).toContain('1,000,000');
  });

  it('小数点以下は含まれない (maximumFractionDigits=0)', () => {
    expect(formatCurrency(124.5)).toBe(toJPY(124.5));
    expect(formatCurrency(124.5)).not.toContain('.');
  });
});

describe('cn (クラス名マージ)', () => {
  it('複数クラスを結合する', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('falsy な値を無視する', () => {
    expect(cn('foo', false && 'hidden', undefined, 'bar')).toBe('foo bar');
  });

  it('TailwindCSS の競合クラスを後勝ちでマージする', () => {
    // tailwind-merge: p-4 に p-2 を上書き
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
});
