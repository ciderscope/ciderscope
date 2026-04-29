export const hsh = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const _wlmCache = new Map<number, number[][]>();
export const wlm = (n: number) => {
  const cached = _wlmCache.get(n);
  if (cached) return cached;
  const R: number[][] = [];
  if (n % 2 === 0) {
    for (let i = 0; i < n; i++) {
      const r: number[] = [];
      for (let j = 0; j < n; j++) r.push(j === 0 ? i : j % 2 === 1 ? (i + Math.ceil(j / 2)) % n : (n - Math.ceil(j / 2) + i) % n);
      R.push(r);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const r: number[] = [];
      for (let j = 0; j < n; j++) r.push((i + j) % n);
      R.push(r);
    }
  }
  _wlmCache.set(n, R);
  return R;
};

import type { AnswerValue } from "../types";

export const formatVal = (v: AnswerValue, t: string) => {
  if (v == null) return '';
  if ((t === 'rank' || t === 'seuil') && Array.isArray(v)) return v.join('>');
  if (Array.isArray(v)) return v.join('|');
  // scale with sub-criteria stored as { _: number, "sub": number, ... }
  if (t === 'scale' && typeof v === 'object') return String((v as Record<string, number>)._ ?? '');
  return String(v);
};
