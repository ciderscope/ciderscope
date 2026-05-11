/**
 * CiderScope Statistics Library
 * Logic for sensory analysis: PCA, ANOVA, Friedman, Discrimination Tests, etc.
 */

// --- Basic Math & Gamma Functions ---

/** ln Γ(x) — Lanczos approximation (precision ~1e-14) */
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < c.length; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** P(a, x) regularized — series expansion (x < a+1) */
function gammaPSeries(a: number, x: number): number {
  const maxIter = 400, eps = 1e-15;
  let sum = 1 / a, term = sum;
  for (let n = 1; n < maxIter; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * eps) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Q(a, x) = 1 - P(a, x) — continued fraction Lentz (x ≥ a+1) */
function gammaQFrac(a: number, x: number): number {
  const maxIter = 400, eps = 1e-15, fpmin = 1e-300;
  let b = x + 1 - a;
  let c = 1 / fpmin, d = 1 / b, h = d;
  for (let i = 1; i <= maxIter; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < fpmin) d = fpmin;
    c = b + an / c; if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

export function regularizedGammaP(a: number, x: number): number {
  if (x <= 0 || a <= 0) return 0;
  return x < a + 1 ? gammaPSeries(a, x) : 1 - gammaQFrac(a, x);
}

/** Chi-square p-value (exact) */
export function chiSquarePValue(chi2: number, df: number): number {
  if (chi2 <= 0 || df <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - regularizedGammaP(df / 2, chi2 / 2)));
}

// --- F Distribution & ANOVA ---

/** Incomplete beta function regularized I_x(a, b) */
function betaCF(x: number, a: number, b: number): number {
  const maxIter = 400, eps = 1e-15, fpmin = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c; if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c; if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

export function regularizedBetaI(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? bt * betaCF(x, a, b) / a
    : 1 - bt * betaCF(1 - x, b, a) / b;
}

/** F-distribution p-value (one-sided) */
export function fPValue(F: number, df1: number, df2: number): number {
  if (F <= 0 || df1 <= 0 || df2 <= 0) return 1;
  return regularizedBetaI(df2 / (df2 + df1 * F), df2 / 2, df1 / 2);
}

/** 
 * Two-way ANOVA (Mixed Model: Product as fixed effect, Judge as random effect)
 * Returns F and p-values for Product and Judge.
 * Note: Interaction Judge x Product is the error term in a standard session (no replicates).
 */
export function anovaTwoWay(
  matrix: (number | null)[][] // matrix[prodIdx][judgeIdx]
): { 
  fProd: number; pProd: number; 
  fJury: number; pJury: number;
  ok: boolean;
} {
  const pN = matrix.length;
  const jN = matrix[0]?.length ?? 0;
  const isComplete = pN >= 2
    && jN >= 2
    && matrix.every(row => row.length === jN && row.every(isFiniteNumber));
  
  if (!isComplete) return { fProd: 0, pProd: 1, fJury: 0, pJury: 1, ok: false };

  const flat = matrix.flat() as number[];
  
  const grand = flat.reduce((a, b) => a + b, 0) / flat.length;
  const prodMeans = matrix.map(row => {
    const v = row.filter(isFiniteNumber);
    return v.reduce((a, b) => a + b, 0) / v.length;
  });
  const juryMeans = Array.from({ length: jN }, (_, j) => {
    const col = matrix.map(row => row[j]).filter(isFiniteNumber);
    return col.reduce((a, b) => a + b, 0) / col.length;
  });

  let ssProd = 0, ssJury = 0, ssTot = 0;
  for (let i = 0; i < pN; i++) ssProd += jN * (prodMeans[i] - grand) ** 2;
  for (let j = 0; j < jN; j++) ssJury += pN * (juryMeans[j] - grand) ** 2;
  for (let i = 0; i < pN; i++) for (let j = 0; j < jN; j++) {
    const v = matrix[i][j] as number;
    ssTot += (v - grand) ** 2;
  }

  const ssErr = Math.max(0, ssTot - ssProd - ssJury);
  const dfProd = pN - 1, dfJury = jN - 1, dfErr = (pN - 1) * (jN - 1);
  
  const msProd = ssProd / dfProd;
  const msJury = ssJury / dfJury;
  const msErr = ssErr / dfErr;

  const fProd = msErr > 0 ? msProd / msErr : 0;
  const pProd = msErr > 0 ? fPValue(fProd, dfProd, dfErr) : 1;
  const fJury = msErr > 0 ? msJury / msErr : 0;
  const pJury = msErr > 0 ? fPValue(fJury, dfJury, dfErr) : 1;

  return { fProd, pProd, fJury, pJury, ok: true };
}

/**
 * One-way ANOVA
 * Handles unbalanced data perfectly. Matrix is an array where each element is an array of values for that group (e.g., product).
 */
export function anovaOneWay(groups: (number | null)[][]): { fVal: number; pValue: number; ok: boolean } {
  const validGroups = groups.map(g => g.filter(isFiniteNumber));
  const flat = validGroups.flat();
  const N = flat.length;
  const k = validGroups.filter(g => g.length > 0).length;

  if (N <= k || k < 2) return { fVal: 0, pValue: 1, ok: false };

  const grandMean = flat.reduce((a, b) => a + b, 0) / N;

  let ssTot = 0;
  let ssBetween = 0;

  for (const group of validGroups) {
    if (group.length === 0) continue;
    const groupMean = group.reduce((a, b) => a + b, 0) / group.length;
    ssBetween += group.length * Math.pow(groupMean - grandMean, 2);
    for (const val of group) {
      ssTot += Math.pow(val - grandMean, 2);
    }
  }

  const ssWithin = Math.max(0, ssTot - ssBetween);
  const dfBetween = k - 1;
  const dfWithin = N - k;

  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;

  if (msWithin <= 0) return { fVal: 0, pValue: 1, ok: false };

  const fVal = msBetween / msWithin;
  const pValue = fPValue(fVal, dfBetween, dfWithin);

  return { fVal, pValue, ok: true };
}

// --- Ranking & Concordance ---

/** Kendall Tau-a correlation */
export function kendallTau(rank1: Record<string, number>, rank2: Record<string, number>, products: string[]): number {
  const n = products.length;
  if (n <= 1) return 1;
  let c = 0, d = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = Math.sign((rank1[products[i]] ?? 0) - (rank1[products[j]] ?? 0));
    const b = Math.sign((rank2[products[i]] ?? 0) - (rank2[products[j]] ?? 0));
    if (a * b > 0) c++;
    else if (a * b < 0) d++;
  }
  return (c - d) / (n * (n - 1) / 2);
}

/** Kendall W concordance coefficient (inter-jury consensus) */
export function kendallW(matrices: Record<string, number>[], products: string[]): number {
  const m = matrices.length, n = products.length;
  if (m < 2 || n < 2) return 1;
  const rankSums: Record<string, number> = {};
  products.forEach(p => {
    rankSums[p] = matrices.reduce((s, mat) => s + (mat[p] ?? (n + 1) / 2), 0);
  });
  const meanSum = products.reduce((s, p) => s + rankSums[p], 0) / n;
  const S = products.reduce((s, p) => s + (rankSums[p] - meanSum) ** 2, 0);
  return (12 * S) / (m * m * (n * n * n - n));
}

/** RV Coefficient (correlation between two multivariate matrices, e.g. judge vs panel) */
export function rvCoefficient(X: number[][], Y: number[][]): number {
  // X and Y are [products x criteria]
  const p = X.length;
  if (p < 2) return 1;
  
  const center = (M: number[][]) => {
    const m = M[0].length;
    const means = Array(m).fill(0).map((_, j) => M.reduce((s, r) => s + r[j], 0) / p);
    return M.map(r => r.map((v, j) => v - means[j]));
  };

  const Xc = center(X);
  const Yc = center(Y);

  const traceAA = (A: number[][], B: number[][]) => {
    let s = 0;
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        let dotA = 0, dotB = 0;
        for (let k = 0; k < A[0].length; k++) dotA += A[i][k] * A[j][k];
        for (let k = 0; k < B[0].length; k++) dotB += B[i][k] * B[j][k];
        s += dotA * dotB;
      }
    }
    return s;
  };

  const num = traceAA(Xc, Yc);
  const den = Math.sqrt(traceAA(Xc, Xc) * traceAA(Yc, Yc));
  return den > 0 ? num / den : 0;
}

// --- PCA & Matrix Operations ---

/** Diagonalize a symmetric matrix using Jacobi rotations */
export function jacobiEigen(A: number[][]): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const D = A.map(r => [...r]);
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const maxSweeps = 100, eps = 1e-14;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) off += Math.abs(D[p][q]);
    if (off < eps) break;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(D[p][q]) < eps) continue;
      const theta = (D[q][q] - D[p][p]) / (2 * D[p][q]);
      const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      const dpp = D[p][p], dqq = D[q][q], dpq = D[p][q];
      D[p][p] = dpp - t * dpq;
      D[q][q] = dqq + t * dpq;
      D[p][q] = D[q][p] = 0;
      for (let i = 0; i < n; i++) {
        if (i !== p && i !== q) {
          const dip = D[i][p], diq = D[i][q];
          D[i][p] = D[p][i] = c * dip - s * diq;
          D[i][q] = D[q][i] = s * dip + c * diq;
        }
        const vip = V[i][p], viq = V[i][q];
        V[i][p] = c * vip - s * viq;
        V[i][q] = s * vip + c * viq;
      }
    }
  }
  const values = D.map((_, i) => D[i][i]);
  const order = values.map((v, i) => [v, i] as [number, number]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  return {
    values: order.map(i => values[i]),
    vectors: V.map(row => order.map(i => row[i])),
  };
}

/** 2D PCA on Correlation Matrix */
export function pca2D(X: number[][]): { scores: number[][]; explained: number[]; loadings: number[][] } {
  const p = X.length, m = X[0]?.length ?? 0;
  if (p < 2 || m < 2) return { scores: X.map(() => [0, 0]), explained: [0, 0], loadings: [] };
  const means = Array(m).fill(0).map((_, j) => X.reduce((s, r) => s + r[j], 0) / p);
  const sds = Array(m).fill(0).map((_, j) => {
    const v = X.reduce((s, r) => s + (r[j] - means[j]) ** 2, 0) / (p - 1);
    return Math.sqrt(v) || 1;
  });
  const Z: number[][] = X.map(r => r.map((v, j) => (v - means[j]) / sds[j]));
  const C: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
    let s = 0;
    for (let k = 0; k < p; k++) s += Z[k][i] * Z[k][j];
    C[i][j] = s / (p - 1);
  }
  const { values, vectors } = jacobiEigen(C);
  const totalVar = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const explained = [Math.max(0, values[0]) / totalVar, Math.max(0, values[1] ?? 0) / totalVar];
  const scores: number[][] = Z.map(row => {
    const s1 = row.reduce((s, v, i) => s + v * vectors[i][0], 0);
    const s2 = row.reduce((s, v, i) => s + v * (vectors[i][1] ?? 0), 0);
    return [s1, s2];
  });
  
  const scoreSds = [
    Math.sqrt(Math.max(0, values[0])),
    Math.sqrt(Math.max(0, values[1] ?? 0))
  ];
  
  const loadings = vectors.map(row => {
    return [
      row[0] * scoreSds[0],
      (row[1] ?? 0) * scoreSds[1]
    ];
  });
  
  return { scores, explained, loadings };
}

// --- Post-hoc & CLD ---

/** Nemenyi Critical Difference */
export function getNemenyiCD(k: number, n: number): number {
  const qValues: Record<number, number> = {
    2: 2.33, 3: 2.90, 4: 3.24, 5: 3.48, 6: 3.66, 7: 3.81, 8: 3.93, 9: 4.04, 10: 4.13,
  };
  const q = qValues[k] || (4.13 + (k - 10) * 0.08);
  return (q / Math.sqrt(2)) * Math.sqrt((k * (k + 1)) / (6 * n));
}

/** Piepho (2004) CLD Algorithm */
export function computeCLD(products: string[], rankMeans: Record<string, number>, cd: number): Record<string, string> {
  const sorted = [...products].sort((a, b) => rankMeans[a] - rankMeans[b]);
  const k = sorted.length;
  const out: Record<string, string> = {};
  products.forEach(p => { out[p] = ""; });
  if (k === 0) return out;

  const sig: boolean[][] = Array.from({ length: k }, () => Array(k).fill(false));
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    const d = Math.abs(rankMeans[sorted[i]] - rankMeans[sorted[j]]);
    if (d > cd) { sig[i][j] = true; sig[j][i] = true; }
  }

  let groups: Set<number>[] = [new Set(sorted.map((_, i) => i))];

  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      if (!sig[i][j]) continue;
      const next: Set<number>[] = [];
      for (const g of groups) {
        if (g.has(i) && g.has(j)) {
          const gi = new Set(g); gi.delete(j);
          const gj = new Set(g); gj.delete(i);
          if (gi.size > 0) next.push(gi);
          if (gj.size > 0) next.push(gj);
        } else next.push(g);
      }
      groups = next;
    }
  }

  const keyOf = (g: Set<number>) => [...g].sort((a, b) => a - b).join(",");
  const uniq = new Map<string, Set<number>>();
  for (const g of groups) uniq.set(keyOf(g), g);
  let arr = [...uniq.values()];
  arr = arr.filter(g => !arr.some(o => o !== g && g.size < o.size && [...g].every(x => o.has(x))));
  arr.sort((a, b) => Math.min(...a) - Math.min(...b));

  const letters = "abcdefghijklmnopqrstuvwxyz";
  const letterFor = (idx: number): string => {
    let n = idx;
    let out = "";
    do {
      out = letters[n % letters.length] + out;
      n = Math.floor(n / letters.length) - 1;
    } while (n >= 0);
    return out;
  };
  arr.forEach((g, idx) => {
    const l = letterFor(idx);
    g.forEach(i => { out[sorted[i]] += l; });
  });
  return out;
}

// --- Discrimination Helper ---

export function binomCoeff(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let c = 1;
  for (let i = 0; i < Math.min(k, n - k); i++) c = c * (n - i) / (i + 1);
  return c;
}

export function binomialPValue(n: number, k: number, p: number): number {
  if (n === 0) return 1;
  let prob = 0;
  for (let i = k; i <= n; i++) prob += binomCoeff(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
  return Math.min(1, prob);
}

/** Inverse N(0,1) — AS241 */
export function normalInvCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const q = p - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = q * q;
    return q * (((((((2509.0809287301226727 * r + 33430.575583588128105) * r + 67265.770927008700853) * r + 45921.953931549871457) * r + 13731.693765509461125) * r + 1971.5909503065514427) * r + 133.14166789178437745) * r + 3.387132872796366608)
      / (((((((5226.495278852854561 * r + 28729.085735721942674) * r + 39307.89580009271061) * r + 21213.794301586595867) * r + 5394.1960214247511077) * r + 687.1870074920579083) * r + 42.313330701600911252) * r + 1);
  }
  let r = q < 0 ? p : 1 - p;
  r = Math.sqrt(-Math.log(r));
  let x: number;
  if (r <= 5) {
    r -= 1.6;
    x = (((((((7.74545014278341407640e-4 * r + 0.0227238449892691845833) * r + 0.24178072517745061177) * r + 1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r + 4.6303378461565452959) * r + 1.42343711074968357734)
      / (((((((1.05075007164441684324e-9 * r + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r + 0.14810397642748007459) * r + 0.68976733498510000455) * r + 1.6763848301838038494) * r + 2.05319162663775882187) * r + 1);
  } else {
    r -= 5;
    x = (((((((2.01033439929228813265e-7 * r + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r + 0.026532189526576123093) * r + 0.29656057182850489123) * r + 1.7848265399172913358) * r + 5.4637849111641143699) * r + 6.6579046435011037772)
      / (((((((2.04426310338993978564e-15 * r + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r + 7.868691311456132591e-4) * r + 0.0148753612908506148525) * r + 0.13692988092273580531) * r + 0.59983220655588793769) * r + 1);
  }
  return q < 0 ? -x : x;
}

// --- HRATA & Advanced Methodologies ---

/**
 * Dravnieks Score (1982) for applicability
 * Combines relative frequency and relative intensity into a single geometric mean score (0-100%).
 * @param freq Number of times attribute was cited
 * @param maxFreq Maximum possible citations (e.g. number of judges)
 * @param sumInt Sum of intensities given
 * @param maxSumInt Maximum possible sum of intensities (maxFreq * maxIntensityScale)
 */
export function dravnieksScore(freq: number, maxFreq: number, sumInt: number, maxSumInt: number): number {
  if (maxFreq <= 0 || maxSumInt <= 0) return 0;
  const relFreq = (freq / maxFreq) * 100;
  const relInt = (sumInt / maxSumInt) * 100;
  return Math.sqrt(relFreq * relInt);
}

/**
 * Cochran's Q Test for binary repeated measures.
 * Useful for determining if a binary attribute (cited/not cited) discriminates between products.
 * @param matrix Binary matrix [subjects x products], where entry is 1 if cited, 0 if not.
 * @returns Q statistic and p-value.
 */
export function cochranQ(matrix: number[][]): { q: number; pValue: number } {
  const n = matrix.length;
  const k = matrix[0]?.length ?? 0;
  if (n < 2 || k < 2) return { q: 0, pValue: 1 };

  let sumTj = 0;
  let sumTj2 = 0;
  const colSums = Array(k).fill(0);
  const rowSums = Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < k; j++) {
      const val = matrix[i][j] > 0 ? 1 : 0;
      colSums[j] += val;
      rowSum += val;
    }
    rowSums[i] = rowSum;
  }

  for (let j = 0; j < k; j++) {
    sumTj += colSums[j];
    sumTj2 += colSums[j] * colSums[j];
  }

  let sumRi = 0;
  let sumRi2 = 0;
  for (let i = 0; i < n; i++) {
    sumRi += rowSums[i];
    sumRi2 += rowSums[i] * rowSums[i];
  }

  const denominator = k * sumRi - sumRi2;
  if (denominator === 0) return { q: 0, pValue: 1 }; // No variance

  const q = ((k - 1) * (k * sumTj2 - sumTj * sumTj)) / denominator;
  const df = k - 1;
  const pValue = chiSquarePValue(q, df);

  return { q, pValue };
}

/** 
 * Unnormalized 2D PCA on Covariance Matrix
 * Preserves the original units (e.g., Dravnieks scores).
 */
export function pcaCovariance(X: number[][]): { scores: number[][]; explained: number[]; loadings: number[][] } {
  const p = X.length, m = X[0]?.length ?? 0;
  if (p < 2 || m < 2) return { scores: X.map(() => [0, 0]), explained: [0, 0], loadings: [] };
  
  const means = Array(m).fill(0).map((_, j) => X.reduce((s, r) => s + r[j], 0) / p);
  const Z: number[][] = X.map(r => r.map((v, j) => v - means[j]));
  
  const Cov: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
    let s = 0;
    for (let k = 0; k < p; k++) s += Z[k][i] * Z[k][j];
    Cov[i][j] = s / (p - 1);
  }
  
  const { values, vectors } = jacobiEigen(Cov);
  const totalVar = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const explained = [Math.max(0, values[0]) / totalVar, Math.max(0, values[1] ?? 0) / totalVar];
  
  const scores: number[][] = Z.map(row => {
    const s1 = row.reduce((s, v, i) => s + v * vectors[i][0], 0);
    const s2 = row.reduce((s, v, i) => s + v * (vectors[i][1] ?? 0), 0);
    return [s1, s2];
  });
  
  // Calculate correlations between original variables and PCs
  // Cor(X_j, PC_k) = (lambda_k * v_{jk}) / (sd(X_j) * sd(PC_k))
  // Since PC_k = X * v_k, Var(PC_k) = lambda_k, so sd(PC_k) = sqrt(lambda_k)
  // Therefore Cor(X_j, PC_k) = sqrt(lambda_k) * v_{jk} / sd(X_j)
  const scoreSds = [
    Math.sqrt(Math.max(0, values[0])),
    Math.sqrt(Math.max(0, values[1] ?? 0))
  ];
  
  const loadings = vectors.map((row, j) => {
    const sdXj = Math.sqrt(Cov[j][j]) || 1;
    const l1 = scoreSds[0] * row[0] / sdXj;
    const l2 = scoreSds[1] * (row[1] ?? 0) / sdXj;
    return [l1, l2];
  });

  return { scores, explained, loadings };
}

/**
 * Projects new (illustrative/supplementary) variables onto an existing PCA space.
 * @param X_new Matrix of new variables [observations x new_vars]
 * @param pcaScores Existing PCA scores for the observations [observations x 2]
 * @returns Projected coordinates for the new variables [new_vars x 2]
 */
export function projectToPCA(X_new: number[][], pcaScores: number[][]): number[][] {
  const n = X_new.length;
  const m_new = X_new[0]?.length ?? 0;
  if (n < 2 || m_new === 0 || pcaScores.length !== n) return [];

  // Normalize new variables
  const means = Array(m_new).fill(0).map((_, j) => X_new.reduce((s, r) => s + r[j], 0) / n);
  const sds = Array(m_new).fill(0).map((_, j) => {
    const v = X_new.reduce((s, r) => s + (r[j] - means[j]) ** 2, 0) / (n - 1);
    return Math.sqrt(v) || 1;
  });
  const Z_new = X_new.map(r => r.map((v, j) => (v - means[j]) / sds[j]));

  // Standardize PCA scores
  const scoreMeans = [0, 0];
  for (let i = 0; i < n; i++) { scoreMeans[0] += pcaScores[i][0]; scoreMeans[1] += pcaScores[i][1]; }
  scoreMeans[0] /= n; scoreMeans[1] /= n;
  
  const scoreSds = [0, 0];
  for (let i = 0; i < n; i++) {
    scoreSds[0] += (pcaScores[i][0] - scoreMeans[0]) ** 2;
    scoreSds[1] += (pcaScores[i][1] - scoreMeans[1]) ** 2;
  }
  scoreSds[0] = Math.sqrt(scoreSds[0] / (n - 1)) || 1;
  scoreSds[1] = Math.sqrt(scoreSds[1] / (n - 1)) || 1;

  const Z_scores = pcaScores.map(r => [
    (r[0] - scoreMeans[0]) / scoreSds[0],
    (r[1] - scoreMeans[1]) / scoreSds[1]
  ]);

  // Project (correlation)
  const projectedLoadings: number[][] = Array.from({ length: m_new }, () => [0, 0]);
  for (let j = 0; j < m_new; j++) {
    let sum1 = 0, sum2 = 0;
    for (let i = 0; i < n; i++) {
      sum1 += Z_new[i][j] * Z_scores[i][0];
      sum2 += Z_new[i][j] * Z_scores[i][1];
    }
    projectedLoadings[j][0] = sum1 / (n - 1);
    projectedLoadings[j][1] = sum2 / (n - 1);
  }

  return projectedLoadings;
}

/**
 * Orthogonal Procrustes Analysis
 * Finds an optimal rotation matrix to align matrix Y to matrix X.
 * @returns The rotated Y matrix (Y_rot) superimposed onto X.
 */
export function procrustes2D(X: number[][], Y: number[][]): { Y_rot: number[][] } {
  const n = X.length;
  if (n === 0 || Y.length !== n) return { Y_rot: Y };

  // Center X and Y
  const cX = [0, 0]; const cY = [0, 0];
  for (let i = 0; i < n; i++) {
    cX[0] += X[i][0]; cX[1] += X[i][1];
    cY[0] += Y[i][0]; cY[1] += Y[i][1];
  }
  cX[0] /= n; cX[1] /= n; cY[0] /= n; cY[1] /= n;

  const Xc = X.map(r => [r[0] - cX[0], r[1] - cX[1]]);
  const Yc = Y.map(r => [r[0] - cY[0], r[1] - cY[1]]);

  // Compute scale
  let normX = 0, normY = 0;
  for (let i = 0; i < n; i++) {
    normX += Xc[i][0] ** 2 + Xc[i][1] ** 2;
    normY += Yc[i][0] ** 2 + Yc[i][1] ** 2;
  }
  normX = Math.sqrt(normX); normY = Math.sqrt(normY);
  
  if (normY === 0) return { Y_rot: Yc };
  
  // Scale Y to match X's scale
  const scale = normX / normY;
  const Ys = Yc.map(r => [r[0] * scale, r[1] * scale]);

  // Compute A = Ys^T * X
  const A = [[0, 0], [0, 0]];
  for (let i = 0; i < n; i++) {
    A[0][0] += Ys[i][0] * Xc[i][0];
    A[0][1] += Ys[i][0] * Xc[i][1];
    A[1][0] += Ys[i][1] * Xc[i][0];
    A[1][1] += Ys[i][1] * Xc[i][1];
  }

  // A^T A
  const ATA = [
    [A[0][0]*A[0][0] + A[1][0]*A[1][0], A[0][0]*A[0][1] + A[1][0]*A[1][1]],
    [A[0][1]*A[0][0] + A[1][1]*A[1][0], A[0][1]*A[0][1] + A[1][1]*A[1][1]]
  ];
  
  const { values, vectors } = jacobiEigen(ATA);
  
  const D_inv_sqrt = [
    values[0] > 1e-10 ? 1/Math.sqrt(values[0]) : 0,
    values[1] > 1e-10 ? 1/Math.sqrt(values[1]) : 0
  ];
  
  const invSqrt = [
    [vectors[0][0]*D_inv_sqrt[0]*vectors[0][0] + vectors[0][1]*D_inv_sqrt[1]*vectors[0][1],
     vectors[0][0]*D_inv_sqrt[0]*vectors[1][0] + vectors[0][1]*D_inv_sqrt[1]*vectors[1][1]],
    [vectors[1][0]*D_inv_sqrt[0]*vectors[0][0] + vectors[1][1]*D_inv_sqrt[1]*vectors[0][1],
     vectors[1][0]*D_inv_sqrt[0]*vectors[1][0] + vectors[1][1]*D_inv_sqrt[1]*vectors[1][1]]
  ];
  
  // R = A * (A^T A)^{-1/2}
  const R = [
    [A[0][0]*invSqrt[0][0] + A[0][1]*invSqrt[1][0], A[0][0]*invSqrt[0][1] + A[0][1]*invSqrt[1][1]],
    [A[1][0]*invSqrt[0][0] + A[1][1]*invSqrt[1][0], A[1][0]*invSqrt[0][1] + A[1][1]*invSqrt[1][1]]
  ];

  // Apply rotation
  const Y_rot = Ys.map(row => [
    row[0] * R[0][0] + row[1] * R[1][0],
    row[0] * R[0][1] + row[1] * R[1][1]
  ]);

  return { Y_rot };
}
