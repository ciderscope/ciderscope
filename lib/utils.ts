export const hsh = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const _wlmCache = new Map<number, number[][]>();
/**
 * Construit un carré de Williams équilibré pour n produits.
 * Pour n pair : un seul carré n x n suffit (Williams, 1949).
 * Pour n impair : nécessite deux carrés n x n pour équilibrer les effets de report (carry-over).
 * Retourne une matrice où chaque ligne est l'ordre de présentation pour un juge.
 */
export const wlm = (n: number): number[][] => {
  const cached = _wlmCache.get(n);
  if (cached) return cached;

  const R: number[][] = [];
  
  if (n % 2 === 0) {
    // Cas n pair : Construction classique de Williams (1 carré)
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        let val: number;
        if (j % 2 === 0) {
          val = (i + Math.floor(j / 2)) % n;
        } else {
          val = (i + n - Math.floor(j / 2) - 1) % n;
        }
        row.push(val);
      }
      R.push(row);
    }
  } else {
    // Cas n impair : Deux carrés n x n sont nécessaires
    // Carré 1 (Williams construction modifiée pour n impair)
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      for (let j = 0; j < n; j++) {
        let val: number;
        if (j % 2 === 0) val = (i + Math.floor(j / 2)) % n;
        else val = (i + n - Math.floor(j / 2) - 1) % n;
        row.push(val);
      }
      R.push(row);
    }
    // Carré 2 (Inversion de l'ordre du Carré 1)
    for (let i = 0; i < n; i++) {
      R.push([...R[i]].reverse());
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
