"use client";
import { useMemo, useState } from "react";
import { Card } from "../ui/Card";
import { ScrollableTabs } from "../ui/ScrollableTabs";
import { Radar, Bar, Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  type TooltipItem,
} from "chart.js";
import type { SessionConfig, SessionListItem, Question, BetLevel, AllAnswers, CSVRow, Product, RadarAxis, RadarAnswer } from "../../types";

// Enregistrement Chart.js localisé : seul l'admin chargeant l'analyse paye le coût.
ChartJS.register(
  RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement
);

const COLORS = ["#c8520a", "#2e6b8a", "#1a6b3a", "#8a4c8a", "#8a6d00", "#5a4030", "#2a5a7a", "#5a6a2a"];

// ─── Stats helpers ───────────────────────────────────────────────────────────

// ln Γ(x) — Lanczos (précision ~1e-14)
function logGamma(x: number): number {
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

// P(a, x) régularisée — série (x < a+1)
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

// Q(a, x) = 1 - P(a, x) — fraction continue Lentz (x ≥ a+1)
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

function regularizedGammaP(a: number, x: number): number {
  if (x <= 0 || a <= 0) return 0;
  return x < a + 1 ? gammaPSeries(a, x) : 1 - gammaQFrac(a, x);
}

// p-value chi² exacte — via gamma incomplète régularisée.
// Fiable à tout df (la précédente approximation Wilson-Hilferty était
// imprécise aux petits df typiques de l'analyse sensorielle).
// Note sur les ex-æquo : le test de Friedman nécessite en principe une
// correction si le panel produit des rangs liés. Le drag-and-drop actuel
// impose un ordre strict donc il n'y a pas de ties à corriger.
function chiSquarePValue(chi2: number, df: number): number {
  if (chi2 <= 0 || df <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - regularizedGammaP(df / 2, chi2 / 2)));
}

// Nemenyi — q de la distribution Studentized Range (α = 0.10, ν = ∞)
// CD = (q / √2) · √(k(k+1)/(6n))  — le /√2 convertit le q range en CD
// de différence de rangs moyens (cf. Conover 1999, Hollander & Wolfe 1999).
function getNemenyiCD(k: number, n: number): number {
  const qValues: Record<number, number> = {
    2: 2.33, 3: 2.90, 4: 3.24, 5: 3.48, 6: 3.66, 7: 3.81, 8: 3.93, 9: 4.04, 10: 4.13,
  };
  const q = qValues[k] || (4.13 + (k - 10) * 0.08);
  return (q / Math.sqrt(2)) * Math.sqrt((k * (k + 1)) / (6 * n));
}

// CLD — algorithme « insert-and-absorb » de Piepho (2004).
// 1. Partir d'un unique groupe contenant tous les produits.
// 2. Pour chaque paire (i, j) sig. différente : scinder tout groupe
//    contenant i ET j en deux (l'un sans i, l'autre sans j).
// 3. Absorption : supprimer les groupes strictement inclus dans un autre.
// Cet algorithme garantit transitivité et couverture complète (contrairement
// à l'heuristique précédente qui pouvait perdre des sous-groupes).
function computeCLD(products: string[], rankMeans: Record<string, number>, cd: number): Record<string, string> {
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
  arr.forEach((g, idx) => {
    const l = letters[idx % 26];
    g.forEach(i => { out[sorted[i]] += l; });
  });
  return out;
}

// Kendall τ-a — concordance d'un classement avec un ordre de référence.
// τ ∈ [-1,1] : 1 = identique, -1 = inverse, 0 = indépendant.
// Plus robuste que Spearman ρ pour petits n et interprétation en paires.
function kendallTau(rank1: Record<string, number>, rank2: Record<string, number>, products: string[]): number {
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

// Kendall W — coefficient de concordance inter-jurys (cohérence du panel).
// W ∈ [0,1] : 0 = désaccord total, 1 = accord parfait. Relié à Friedman :
// χ² = m·(n-1)·W. Indicateur direct de l'entraînement du panel.
function kendallW(matrices: Record<string, number>[], products: string[]): number {
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

// ─── Distributions F et inverse normale ──────────────────────────────────────

// Beta incomplète régularisée I_x(a, b) — fraction continue (Numerical Recipes)
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

function regularizedBetaI(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? bt * betaCF(x, a, b) / a
    : 1 - bt * betaCF(1 - x, b, a) / b;
}

// p-value F unilatérale (F, df1, df2)
function fPValue(F: number, df1: number, df2: number): number {
  if (F <= 0 || df1 <= 0 || df2 <= 0) return 1;
  return regularizedBetaI(df2 / (df2 + df1 * F), df2 / 2, df1 / 2);
}

// Inverse N(0,1) — algorithme AS241 (Wichura 1988), précision ~1e-16
function normalInvCDF(p: number): number {
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

// ─── ACP via Jacobi (décomposition symétrique) ───────────────────────────────

// Diagonalise une matrice symétrique A (n × n).
// Retourne { values: λ trié décroissant, vectors: V[i][k] = i-ème composante du k-ème vecteur propre }
function jacobiEigen(A: number[][]): { values: number[]; vectors: number[][] } {
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

// ACP sur matrice p × m (lignes = individus, colonnes = variables).
// Centrage-réduction par colonne → ACP sur matrice de corrélation.
// Retourne scores p × 2 (CP1, CP2) + variance expliquée.
function pca2D(X: number[][]): { scores: number[][]; explained: number[]; loadings: number[][] } {
  const p = X.length, m = X[0]?.length ?? 0;
  if (p < 2 || m < 2) return { scores: X.map(() => [0, 0]), explained: [0, 0], loadings: [] };
  // Centrer-réduire
  const means = Array(m).fill(0).map((_, j) => X.reduce((s, r) => s + r[j], 0) / p);
  const sds = Array(m).fill(0).map((_, j) => {
    const v = X.reduce((s, r) => s + (r[j] - means[j]) ** 2, 0) / (p - 1);
    return Math.sqrt(v) || 1;
  });
  const Z: number[][] = X.map(r => r.map((v, j) => (v - means[j]) / sds[j]));
  // Corrélation = Z^T Z / (p - 1)
  const C: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
    let s = 0;
    for (let k = 0; k < p; k++) s += Z[k][i] * Z[k][j];
    C[i][j] = s / (p - 1);
  }
  const { values, vectors } = jacobiEigen(C);
  const totalVar = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const explained = [Math.max(0, values[0]) / totalVar, Math.max(0, values[1] ?? 0) / totalVar];
  // Scores = Z · V (2 premières colonnes)
  const scores: number[][] = Z.map(row => {
    const s1 = row.reduce((s, v, i) => s + v * vectors[i][0], 0);
    const s2 = row.reduce((s, v, i) => s + v * (vectors[i][1] ?? 0), 0);
    return [s1, s2];
  });
  // Loadings = vecteurs propres (variables)
  const loadings = vectors.map(row => [row[0], row[1] ?? 0]);
  return { scores, explained, loadings };
}

// Conformité = corrélation de Pearson entre notes du jury et moyennes du panel
const pearson = (xs: number[], ys: number[]): number => {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
};

function wordColor(w: string) {
  let h = 0;
  for (const c of w) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[h % COLORS.length];
}

// ─── Dynamic tab computation ──────────────────────────────────────────────────

type Tab = { id: string; label: string; questionId?: string; qType?: string };

const STATS_QTYPES: Record<string, string> = {
  classement: "Classement",
  seuil: "Seuil",
  triangulaire: "Triangulaire",
  "duo-trio": "Duo-trio",
  "a-non-a": "A-non-A",
  "seuil-bet": "Seuil 3-AFC",
};

function computeTabs(anCfg: SessionConfig | null): Tab[] {
  if (!anCfg) return [{ id: "données", label: "Données" }];
  const qs: Question[] = anCfg.questions || [];
  const tabs: Tab[] = [];

  if (qs.some(q => q.type === "scale")) tabs.push({ id: "profil", label: "Échelle" });

  if (qs.some(q => q.type === "radar")) tabs.push({ id: "radar", label: "Toile d'araignée" });

  qs.forEach((q: Question) => {
    const prefix = STATS_QTYPES[q.type];
    if (prefix) {
      tabs.push({
        id: `q:${q.id}`,
        label: `${prefix} — ${q.label}`,
        questionId: q.id,
        qType: q.type,
      });
    }
  });

  if (qs.some(q => q.type === "text")) tabs.push({ id: "texte", label: "Nuage de mots" });
  tabs.push({ id: "jury",    label: "Par jury" });
  tabs.push({ id: "données", label: "Données" });
  return tabs;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AnalyseViewProps {
  sessions: SessionListItem[];
  anSessId: string | null;
  anCfg: SessionConfig | null;
  csvData: CSVRow[];
  allAnswers: AllAnswers;
  curAnT: string;
  onAnSessChange: (id: string) => void;
  onAnTabChange: (tab: string) => void;
  downloadCSV: (rows: CSVRow[], name: string) => void;
}

export const AnalyseView = ({
  sessions, anSessId, anCfg, csvData, allAnswers, curAnT,
  onAnSessChange, onAnTabChange, downloadCSV
}: AnalyseViewProps) => {
  const tabs = useMemo(() => computeTabs(anCfg), [anCfg]);

  // Auto-select first valid tab when config changes
  const validIds = tabs.map(t => t.id);
  const activeTab = validIds.includes(curAnT) ? curAnT : (validIds[0] ?? "données");

  return (
    <div className="analyse-shell">
      {/* Session selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", flexWrap: "wrap" }}>
        <h2 style={{ fontWeight: 800, fontSize: "clamp(17px,2.5vw,22px)" }}>Analyse</h2>
        <div style={{ flex: 1 }} />
        <label style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: "11px", color: "var(--mid)" }}>Séance :</label>
        <select
          value={anSessId || ""}
          onChange={(e) => onAnSessChange(e.target.value)}
          style={{ border: "1px solid var(--border)", borderRadius: "6px", padding: "5px 8px", fontSize: "12px" }}
        >
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {anCfg && (
          <button
            onClick={() => downloadCSV(csvData, anCfg.name)}
            style={{ fontSize: "12px", padding: "5px 10px", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer", background: "var(--paper)", color: "var(--ink)" }}
          >
            ↓ CSV
          </button>
        )}
      </div>

      {!anCfg && (
        <div style={{ color: "var(--text-muted)", fontSize: "14px", padding: "32px 0" }}>
          Sélectionnez une séance pour afficher l&apos;analyse.
        </div>
      )}

      {anCfg && (
        <>
          {/* Dynamic tabs */}
          <ScrollableTabs className="analyse-tabs" activeKey={activeTab} ariaLabel="Onglets d'analyse">
            {tabs.map(t => (
              <div
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                className={`analyse-tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => onAnTabChange(t.id)}
              >
                {t.label}
              </div>
            ))}
          </ScrollableTabs>

          <div id="anContent">
            {activeTab === "profil"  && <AnalyseProfil    config={anCfg} data={csvData} />}
            {activeTab === "radar"   && <AnalyseRadar     config={anCfg} allAnswers={allAnswers} />}
            {activeTab === "texte"   && <AnalyseWordCloud data={csvData} config={anCfg} />}
            {activeTab === "jury"    && <AnalyseJury      config={anCfg} allAnswers={allAnswers} />}
            {activeTab === "données" && <AnalyseDonnees   data={csvData} />}
            {activeTab.startsWith("q:") && (() => {
              const tab = tabs.find(t => t.id === activeTab);
              const q = tab?.questionId ? (anCfg.questions || []).find((x: Question) => x.id === tab.questionId) : null;
              if (!q) return null;
              if (q.type === "classement" || q.type === "seuil")
                return <AnalyseFriedman config={anCfg} data={csvData} type={q.type} questionLabel={q.label} />;
              if (q.type === "triangulaire")
                return <AnalyseDiscrimType data={csvData} type="triangulaire" label="Triangulaire" questionLabel={q.label} />;
              if (q.type === "duo-trio")
                return <AnalyseDiscrimType data={csvData} type="duo-trio" label="Duo-trio" questionLabel={q.label} />;
              if (q.type === "a-non-a")
                return <AnalyseDiscrimType data={csvData} type="a-non-a" label="A-non-A" questionLabel={q.label} />;
              if (q.type === "seuil-bet")
                return <AnalyseSeuilBET config={anCfg} allAnswers={allAnswers} questionId={q.id} />;
              return null;
            })()}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Échelle (moyennes des questions de type scale) ─────────────────────────

function AnalyseProfil({ config, data }: { config: SessionConfig; data: CSVRow[] }) {
  // On ne garde que les questions définies comme "scale" dans la config
  // (les axes de la toile sont exclus : ils ont type="scale" dans le CSV mais proviennent de questions "radar").
  const scaleQuestions = (config.questions || []).filter(q => q.type === "scale");
  if (scaleQuestions.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune question d&apos;échelle dans cette séance.</div>;
  }

  const scaleLabels = new Set(scaleQuestions.map(q => q.label));
  const scaleData = data.filter(r =>
    r.type === "scale" && scaleLabels.has(r.question) && r.valeur !== "" && r.valeur != null
  );

  if (scaleData.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune réponse d&apos;échelle disponible.</div>;
  }

  const stats = (vals: number[]) => {
    if (vals.length === 0) return { n: 0, mean: null as number | null, sd: null as number | null };
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = vals.length > 1
      ? Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1))
      : null;
    return { n: vals.length, mean: m, sd };
  };

  const fmt = (n: number | null, d = 2) => n == null ? "—" : n.toFixed(d);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {scaleQuestions.map(q => {
        const rows = scaleData.filter(r => r.question === q.label);
        if (rows.length === 0) {
          return (
            <Card key={q.id} title={q.label}>
              <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Aucune réponse enregistrée.</div>
            </Card>
          );
        }

        if (q.scope === "per-product") {
          const products = [...new Set(rows.map(r => r.produit))];
          return (
            <Card key={q.id} title={q.label}>
              <div style={{ fontSize: "11px", color: "var(--mid)", marginBottom: "8px", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                Moyenne par échantillon
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Échantillon</th>
                    <th>n</th>
                    <th>Moyenne</th>
                    <th>Écart-type</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const vals = rows.filter(r => r.produit === p).map(r => parseFloat(r.valeur)).filter(v => !isNaN(v));
                    const s = stats(vals);
                    return (
                      <tr key={p}>
                        <td>{p}</td>
                        <td className="num">{s.n}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{fmt(s.mean)}</td>
                        <td className="num">{s.sd == null ? "—" : `±${s.sd.toFixed(2)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          );
        }

        // scope global : une seule moyenne pour l'ensemble du questionnaire
        const vals = rows.map(r => parseFloat(r.valeur)).filter(v => !isNaN(v));
        const s = stats(vals);
        return (
          <Card key={q.id} title={q.label}>
            <div style={{ fontSize: "11px", color: "var(--mid)", marginBottom: "8px", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
              Moyenne sur l&apos;ensemble du questionnaire
            </div>
            <div style={{ display: "flex", gap: "28px", alignItems: "baseline", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--mid)" }}>Moyenne</div>
                <div style={{ fontSize: "28px", fontWeight: 700 }}>{fmt(s.mean)}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--mid)" }}>Écart-type</div>
                <div style={{ fontSize: "18px" }}>{s.sd == null ? "—" : `±${s.sd.toFixed(2)}`}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--mid)" }}>n réponses</div>
                <div style={{ fontSize: "18px" }}>{s.n}</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Classement & Seuil → Friedman + Nemenyi ──────────────────────────────────

function AnalyseFriedman({ config, data, type, questionLabel }: { config: SessionConfig; data: CSVRow[]; type: "classement" | "seuil"; questionLabel: string }) {
  const rankRows = data.filter(r => r.type === type && r.valeur && r.question === questionLabel);
  const title = type === "seuil" ? "Seuil" : "Classement";

  if (rankRows.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune donnée de {type} disponible.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {[questionLabel].map(q => {
        const qRows = rankRows.filter(r => r.question === q && r.valeur);
        // Parse "A>B>C" → {A:1, B:2, C:3}
        const matrices: Record<string, number>[] = qRows
          .map(r => {
            const parts = (r.valeur as string).split(">");
            const obj: Record<string, number> = {};
            parts.forEach((code, idx) => { obj[code.trim()] = idx + 1; });
            return obj;
          })
          .filter(m => Object.keys(m).length > 0);

        const products = [...new Set(matrices.flatMap(m => Object.keys(m)))];
        const n = matrices.length;
        const k = products.length;

        if (n < 2 || k < 2) {
          return (
            <Card key={q} title={`${title} — ${q}`}>
              <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                Pas assez de réponses ({n} jury{n > 1 ? "s" : ""}) pour calculer le test de Friedman.
              </p>
            </Card>
          );
        }

        // Rank sums
        const rankSums: Record<string, number> = {};
        products.forEach(p => {
          rankSums[p] = matrices.reduce((s, m) => s + (m[p] ?? (k + 1) / 2), 0);
        });
        const rankMeans: Record<string, number> = {};
        products.forEach(p => { rankMeans[p] = rankSums[p] / n; });

        // Friedman chi2
        const sumRankSq = products.reduce((s, p) => s + rankSums[p] ** 2, 0);
        const chi2 = (12 / (n * k * (k + 1))) * sumRankSq - 3 * n * (k + 1);
        const df = k - 1;
        const pValue = chiSquarePValue(chi2, df);

        const sig = pValue < 0.001 ? "***" : pValue < 0.01 ? "**" : pValue < 0.05 ? "*" : "ns";
        const sigColor = pValue < 0.05 ? "#1a6b3a" : "#888";

        // Correct order comparison — Kendall τ vs ordre attendu
        const correctStr = qRows[0]?.correct || "";
        const correctProducts = correctStr ? correctStr.split(">").map((s: string) => s.trim()) : [];
        let matchCount = 0;
        let avgTau = 0;

        if (correctProducts.length > 0) {
          const correctRank: Record<string, number> = {};
          correctProducts.forEach((p: string, idx: number) => { correctRank[p] = idx + 1; });

          matrices.forEach(m => {
            if (Object.keys(m).every((p: string) => correctRank[p] === m[p])) matchCount++;
            avgTau += kendallTau(correctRank, m, products);
          });
          avgTau /= n;
        }

        // Concordance inter-jurys du panel (indépendant de l'ordre attendu)
        const panelW = kendallW(matrices, products);

        // Nemenyi Post-hoc & CLD
        const nemenyiCD = getNemenyiCD(k, n);
        const cld = pValue < 0.05 ? computeCLD(products, rankMeans, nemenyiCD) : {};

        // Identification du seuil (si p < 0.05)
        let thresholdProduct: string | null = null;
        if (type === "seuil" && pValue < 0.05) {
          const sortedByMeanLocal = [...products].sort((a, b) => rankMeans[a] - rankMeans[b]);
          const firstGroup = cld[sortedByMeanLocal[0]] || "";
          // Le premier échantillon dont le groupe ne contient pas les lettres du premier échantillon
          // On cherche le premier qui n'a AUCUNE lettre commune avec le groupe 'a' initial
          // Ou plus simplement, si les groupes sont a, ab, b -> le premier sans 'a'
          thresholdProduct = sortedByMeanLocal.find(p => {
            const letters = cld[p] || "";
            return ![...firstGroup].some(l => letters.includes(l));
          }) || null;
        }

        // Bar chart data — rank means (lower = better rank)
        const sortedByMean = [...products].sort((a, b) => rankMeans[a] - rankMeans[b]);
        const barData = {
          labels: sortedByMean,
          datasets: [{
            label: "Rang moyen",
            data: sortedByMean.map((p: string) => parseFloat(rankMeans[p].toFixed(2))),
            backgroundColor: sortedByMean.map((_, i) => COLORS[i % 8] + "cc"),
            borderColor: sortedByMean.map((_, i) => COLORS[i % 8]),
            borderWidth: 1,
          }]
        };

        return (
          <Card key={q} title={`${title} — ${q}`}>
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 260px", maxWidth: "360px" }}>
                <Bar
                  data={barData}
                  options={{
                    indexAxis: "y" as const,
                    scales: { x: { beginAtZero: true, max: k, title: { display: true, text: "Rang moyen (1 = 1er)" } } },
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Produit</th><th>Rang moyen</th>{pValue < 0.05 && <th>Gr.</th>}</tr>
                  </thead>
                  <tbody>
                    {sortedByMean.map(p => (
                      <tr key={p}>
                        <td style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{p}</td>
                        <td className="num">{rankMeans[p].toFixed(2)}</td>
                        {pValue < 0.05 && <td style={{ textAlign: "center", fontWeight: 700, color: "var(--accent)" }}>{cld[p]}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: "16px", padding: "12px 14px", background: "var(--bg)", borderRadius: "8px", fontSize: "13px", lineHeight: 1.8 }}>
                  <div><strong>Test de Friedman</strong> (α=0,05)</div>
                  <div>n = {n} jurys · k = {k} produits</div>
                  <div>χ² = {chi2.toFixed(3)} · p = {pValue < 0.001 ? "< 0,001" : pValue.toFixed(3)} <span style={{ fontWeight: 700, color: sigColor }}>{sig}</span></div>
                  <div title="Coefficient de concordance de Kendall — cohérence inter-jurys du panel. 1 = accord parfait, 0 = désaccord total.">
                    <span style={{ color: "var(--text-muted)" }}>W de Kendall (concordance panel) = </span>
                    <span style={{ fontWeight: 600, color: panelW >= 0.7 ? "#1a6b3a" : panelW >= 0.4 ? "#8a6d00" : "var(--danger)" }}>
                      {panelW.toFixed(2)}
                    </span>
                  </div>

                  {pValue < 0.05 && (
                    <div style={{ marginTop: "12px" }}>
                      <strong>Post-hoc de Nemenyi</strong> (α=0,10)
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Différence Critique (CD) = {nemenyiCD.toFixed(2)}</div>
                      <div style={{ fontSize: "11px", color: "#1a6b3a", fontStyle: "italic", marginBottom: "8px" }}>
                        Les produits partageant une même lettre ne sont pas significativement différents.
                      </div>
                      
                      {/* Pairwise comparisons table */}
                      <details>
                        <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--mid)" }}>Afficher les comparaisons par paires</summary>
                        <table className="data-table" style={{ marginTop: "8px", fontSize: "11px" }}>
                          <thead>
                            <tr><th>Paire</th><th>Diff. Σ Rangs</th><th>Signif.</th></tr>
                          </thead>
                          <tbody>
                            {products.map((p1: string, i: number) => 
                              products.slice(i + 1).map((p2: string) => {
                                const diff = Math.abs(rankSums[p1] - rankSums[p2]);
                                const isSig = diff > nemenyiCD * n;
                                return (
                                  <tr key={`${p1}-${p2}`}>
                                    <td>{p1} vs {p2}</td>
                                    <td className="num">{diff.toFixed(1)}</td>
                                    <td style={{ color: isSig ? "var(--danger)" : "var(--mid)", fontWeight: isSig ? 700 : 400 }}>
                                      {isSig ? "Oui" : "Non"}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </details>
                    </div>
                  )}

                  {thresholdProduct && (
                    <div style={{ marginTop: "12px", padding: "10px", background: "var(--paper2)", borderLeft: "4px solid var(--accent)", borderRadius: "4px" }}>
                      <strong>Conclusion Seuil</strong>
                      <div>L&apos;échantillon marquant le seuil est : <strong>{thresholdProduct}</strong></div>
                      {config?.products?.find((p: Product) => p.code === thresholdProduct)?.label && (
                        <div style={{ fontSize: "12px", color: "var(--mid)", fontStyle: "italic", marginTop: "4px" }}>
                          Descripteurs : {config.products.find((p: Product) => p.code === thresholdProduct)?.label}
                        </div>
                      )}
                    </div>
                  )}

                  {correctProducts.length > 0 && (
                    <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                      <strong>Conformité à l&apos;ordre attendu</strong>
                      <div>{matchCount} / {n} jurys exacts ({(matchCount / n * 100).toFixed(0)}%)</div>
                      <div title="τ de Kendall — concordance en paires avec l'ordre attendu. 1 = identique, 0 = aléatoire, -1 = inverse.">
                        τ de Kendall moyen = <span style={{ fontWeight: 600 }}>{avgTau.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Attendu : {correctProducts.join(" > ")}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {type === "seuil" && (
               <details style={{ marginTop: "16px" }}>
                 <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--mid)" }}>Afficher la distribution des rangs</summary>
                 <div style={{ marginTop: "10px", display: "flex", gap: "20px", flexWrap: "wrap" }}>
                    <table className="data-table" style={{ flex: 1 }}>
                      <thead><tr><th>Produit</th>{products.map((_, i) => <th key={i}>R{i + 1}</th>)}</tr></thead>
                      <tbody>
                        {products.map((p: string) => (
                          <tr key={p}>
                            <td>{p}</td>
                            {products.map((_, idx) => {
                              const count = matrices.filter((m: Record<string, number>) => m[p] === idx + 1).length;
                              return <td key={idx} className="num">{count}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
               </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}


// ─── Tests discriminatifs (un type à la fois) ─────────────────────────────────

function AnalyseDiscrimType({ data, type, label, questionLabel }: { data: CSVRow[]; type: string; label: string; questionLabel: string }) {
  const dd = data.filter(r => r.type === type && r.question === questionLabel);

  if (dd.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune donnée disponible.</div>;
  }

  // Binomial test p-value (exact, one-sided)
  // P(X >= k | n, p_chance) where p_chance = 1/3 for triangulaire, 1/2 for duo-trio, varies for a-non-a
  const pChance = type === "triangulaire" ? 1 / 3 : type === "duo-trio" ? 1 / 2 : 0.5;

  const binomialPValue = (n: number, k: number, p: number): number => {
    if (n === 0) return 1;
    // P(X >= k) = sum P(X=i) for i=k..n
    let prob = 0;
    for (let i = k; i <= n; i++) {
      prob += binomCoeff(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
    }
    return Math.min(1, prob);
  };

  const binomCoeff = (n: number, k: number): number => {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    let c = 1;
    for (let i = 0; i < Math.min(k, n - k); i++) {
      c = c * (n - i) / (i + 1);
    }
    return c;
  };

  // Minimum correct answers for significance (p<0.05, one-sided)
  const minCorrect = (n: number, p: number): number => {
    for (let k = n; k >= 0; k--) {
      if (binomialPValue(n, k, p) >= 0.05) return k + 1;
    }
    return 0;
  };

  if (type === "a-non-a") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {[questionLabel].map(q => {
          const qd = dd.filter(r => r.question === q);
          // Agrégation en table 2×2 : lignes = stimulus (A / non-A), colonnes = réponse (A / non-A)
          let hits = 0, misses = 0, fa = 0, cr = 0;
          const perJury: Array<{ jury: string; hit: number; miss: number; fa: number; cr: number }> = [];
          qd.forEach(r => {
            let val: Record<string, string> = {};
            let cor: Record<string, string> = {};
            try {
              val = typeof r.valeur === "string" && r.valeur.startsWith("{") ? JSON.parse(r.valeur) : (r.valeur || {});
              cor = typeof r.correct === "string" && r.correct.includes(":")
                ? Object.fromEntries(r.correct.split(",").map((p: string) => p.split(":")))
                : {};
            } catch { /* ignore */ }
            let h = 0, m = 0, f = 0, c = 0;
            Object.keys(cor).forEach(code => {
              const stim = cor[code];
              const resp = val[code];
              if (!resp) return;
              if (stim === "A" && resp === "A") h++;
              else if (stim === "A" && resp === "non-A") m++;
              else if (stim === "non-A" && resp === "A") f++;
              else if (stim === "non-A" && resp === "non-A") c++;
            });
            hits += h; misses += m; fa += f; cr += c;
            perJury.push({ jury: r.jury, hit: h, miss: m, fa: f, cr: c });
          });

          const nA = hits + misses;
          const nNonA = fa + cr;
          const total = nA + nNonA;
          // Macmillan & Kaplan correction to avoid z(0) / z(1)
          const H = nA > 0 ? Math.min(Math.max(hits / nA, 0.5 / nA), (nA - 0.5) / nA) : 0.5;
          const F = nNonA > 0 ? Math.min(Math.max(fa / nNonA, 0.5 / nNonA), (nNonA - 0.5) / nNonA) : 0.5;
          const dPrime = normalInvCDF(H) - normalInvCDF(F);

          // Chi² 2×2 avec correction de Yates
          const rowA = nA, rowN = nNonA, colA = hits + fa, colN = misses + cr;
          let chi2 = 0;
          const cells = [
            { o: hits,   e: rowA * colA / total },
            { o: misses, e: rowA * colN / total },
            { o: fa,     e: rowN * colA / total },
            { o: cr,     e: rowN * colN / total },
          ];
          if (total > 0 && rowA > 0 && rowN > 0 && colA > 0 && colN > 0) {
            cells.forEach(c => { chi2 += Math.pow(Math.abs(c.o - c.e) - 0.5, 2) / c.e; });
          }
          const pVal = total > 0 ? chiSquarePValue(chi2, 1) : 1;
          const sig = pVal < 0.001 ? "***" : pVal < 0.01 ? "**" : pVal < 0.05 ? "*" : "ns";
          const sigColor = pVal < 0.05 ? "#1a6b3a" : "#888";

          // Interprétation pédagogique de d' (Green & Swets, Macmillan & Creelman)
          const dInterp = Math.abs(dPrime) < 0.5 ? "très faible" : Math.abs(dPrime) < 1 ? "faible" : Math.abs(dPrime) < 1.5 ? "modérée" : Math.abs(dPrime) < 2.5 ? "forte" : "très forte";

          return (
            <Card key={q} title={`${label} — ${q}`}>
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ textAlign: "center", minWidth: "140px" }}>
                  <div style={{ fontSize: "clamp(36px,5vw,52px)", fontWeight: 800, color: sigColor }}>
                    d&apos; = {dPrime.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>indice de discrimination</div>
                  <div style={{ fontSize: "13px", color: sigColor, marginTop: "4px", fontStyle: "italic" }}>{dInterp}</div>
                </div>

                <div style={{ flex: 1, minWidth: "260px" }}>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Table 2×2 agrégée</div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Réponse &laquo;&nbsp;A&nbsp;&raquo;</th>
                        <th>Réponse &laquo;&nbsp;non-A&nbsp;&raquo;</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Stimulus A</strong></td>
                        <td className="num" style={{ color: "#1a6b3a", fontWeight: 600 }}>{hits} <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>(hit)</span></td>
                        <td className="num" style={{ color: "#c0392b" }}>{misses} <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>(miss)</span></td>
                        <td className="num">{nA}</td>
                      </tr>
                      <tr>
                        <td><strong>Stimulus non-A</strong></td>
                        <td className="num" style={{ color: "#c0392b" }}>{fa} <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>(FA)</span></td>
                        <td className="num" style={{ color: "#1a6b3a", fontWeight: 600 }}>{cr} <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>(CR)</span></td>
                        <td className="num">{nNonA}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ padding: "12px 14px", background: "var(--bg)", borderRadius: "8px", fontSize: "13px", lineHeight: 1.8, marginTop: "10px" }}>
                    <div>Taux de détection (hit rate) : <strong>{(H * 100).toFixed(1)}%</strong></div>
                    <div>Taux de fausse alarme : <strong>{(F * 100).toFixed(1)}%</strong></div>
                    <div>χ² (Yates, ddl=1) = {chi2.toFixed(2)} &middot; p = {pVal < 0.001 ? "< 0,001" : pVal.toFixed(3)} <span style={{ fontWeight: 700, color: sigColor }}>{sig}</span></div>
                    {pVal < 0.05
                      ? <div style={{ color: "#1a6b3a", fontWeight: 600, marginTop: "4px" }}>Discrimination significative entre A et non-A (α=0,05)</div>
                      : <div style={{ color: "#c0392b", marginTop: "4px" }}>Pas de différence détectée (α=0,05)</div>}
                  </div>
                </div>
              </div>

              <details style={{ marginTop: "14px" }}>
                <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--mid)" }}>Détail par jury</summary>
                <table className="data-table" style={{ marginTop: "8px" }}>
                  <thead>
                    <tr><th>Jury</th><th>Hits</th><th>Miss</th><th>FA</th><th>CR</th><th>% correct</th></tr>
                  </thead>
                  <tbody>
                    {perJury.map((j, i) => {
                      const nj = j.hit + j.miss + j.fa + j.cr;
                      const pc = nj ? ((j.hit + j.cr) / nj * 100).toFixed(0) : "—";
                      return (
                        <tr key={i}>
                          <td>{j.jury}</td>
                          <td className="num">{j.hit}</td>
                          <td className="num">{j.miss}</td>
                          <td className="num">{j.fa}</td>
                          <td className="num">{j.cr}</td>
                          <td className="num">{pc}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {[questionLabel].map(q => {
        const qd = dd.filter(r => r.question === q);
        const n = qd.length;
        const nc = qd.filter(r => r.valeur === r.correct).length;

        const pVal = binomialPValue(n, nc, pChance);
        const sig = pVal < 0.001 ? "***" : pVal < 0.01 ? "**" : pVal < 0.05 ? "*" : "ns";
        const sigColor = pVal < 0.05 ? "#1a6b3a" : "#888";
        const minC = minCorrect(n, pChance);
        const pct = n ? (nc / n * 100).toFixed(0) : 0;

        return (
          <Card key={q} title={`${label} — ${q}`}>
            <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ textAlign: "center", minWidth: "120px" }}>
                <div style={{ fontSize: "clamp(36px,5vw,52px)", fontWeight: 800, color: nc >= minC ? "#1a6b3a" : "#888" }}>
                  {nc}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>réponses correctes</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: sigColor, marginTop: "6px" }}>{pct}%</div>
              </div>

              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ padding: "12px 14px", background: "var(--bg)", borderRadius: "8px", fontSize: "13px", lineHeight: 1.9 }}>
                  <div><strong>Test binomial</strong> (unilatéral)</div>
                  <div>Probabilité chance : {(pChance * 100).toFixed(0)}%</div>
                  <div>Seuil de signification (p&lt;0,05) : ≥ {minC} bonnes réponses</div>
                  <div>
                    p = {pVal < 0.001 ? "< 0,001" : pVal.toFixed(3)}
                    {" "}
                    <span style={{ fontWeight: 700, color: sigColor }}>{sig}</span>
                  </div>
                  {pVal < 0.05
                    ? <div style={{ color: "#1a6b3a", fontWeight: 600, marginTop: "4px" }}>
                        Le panel discrimine significativement les produits (α=0,05)
                      </div>
                    : <div style={{ color: "#c0392b", marginTop: "4px" }}>
                        Pas de différence détectée (α=0,05)
                      </div>
                  }
                </div>

                <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Détail par jury
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>Jury</th><th>Réponse</th><th>Résultat</th></tr>
                  </thead>
                  <tbody>
                    {qd.map((r, i) => {
                      const correct = r.valeur === r.correct;
                      return (
                        <tr key={i}>
                          <td>{r.jury}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: "11px" }}>
                            {typeof r.valeur === "string" && r.valeur.length > 30
                              ? r.valeur.slice(0, 30) + "…"
                              : r.valeur}
                          </td>
                          <td style={{ color: correct ? "#1a6b3a" : "#c0392b", fontWeight: 600 }}>
                            {correct ? "✓" : "✗"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Seuil BET (3-AFC, ASTM E679) ─────────────────────────────────────────────

function AnalyseSeuilBET({ config, allAnswers, questionId }: { config: SessionConfig; allAnswers: AllAnswers; questionId: string }) {
  const questions: Question[] = (config?.questions || []).filter((q: Question) => q.type === "seuil-bet" && q.id === questionId);
  const jurors = Object.keys(allAnswers || {});

  if (questions.length === 0 || jurors.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune donnée disponible.</div>;
  }

  const computeBET = (levels: BetLevel[], answers: Record<string, string>): { bet: number | null; censored: "low" | "high" | null; trace: ("+" | "-" | "?")[] } => {
    const trace: ("+" | "-" | "?")[] = levels.map((lv, i) => {
      const a = answers?.[String(i)];
      if (a == null || a === "") return "?";
      return a === lv.correctAnswer ? "+" : "-";
    });
    const n = levels.length;
    const allCorrect = trace.every(t => t === "+");
    const allWrong = trace.every(t => t === "-");
    if (allCorrect) {
      const step = n > 1 ? levels[1].concentration / levels[0].concentration : Math.SQRT2;
      return { bet: levels[0].concentration / Math.sqrt(step), censored: "low", trace };
    }
    if (allWrong) {
      const step = n > 1 ? levels[n - 1].concentration / levels[n - 2].concentration : Math.SQRT2;
      return { bet: levels[n - 1].concentration * Math.sqrt(step), censored: "high", trace };
    }
    let lastFail = -1;
    for (let i = n - 1; i >= 0; i--) {
      if (trace[i] === "-") { lastFail = i; break; }
    }
    if (lastFail === -1 || lastFail === n - 1) return { bet: null, censored: null, trace };
    const cLow = levels[lastFail].concentration;
    const cHigh = levels[lastFail + 1].concentration;
    return { bet: Math.sqrt(cLow * cHigh), censored: null, trace };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {questions.map((q: Question) => {
        const levels: BetLevel[] = q.betLevels || [];
        if (levels.length === 0) {
          return (
            <Card key={q.id} title={`Seuil 3-AFC — ${q.label}`}>
              <div style={{ color: "var(--text-muted)" }}>Aucun niveau défini.</div>
            </Card>
          );
        }

        const perJury = jurors.map(j => {
          const answers = (allAnswers[j]?._discrim?.[q.id] || {}) as unknown as Record<string, string>;
          const { bet, censored, trace } = computeBET(levels, answers);
          return { jury: j, bet, censored, trace };
        });

        const valid = perJury.filter(r => r.bet != null && Number.isFinite(r.bet) && (r.bet as number) > 0);
        const groupBET = valid.length > 0
          ? Math.exp(valid.reduce((s, r) => s + Math.log(r.bet as number), 0) / valid.length)
          : null;

        const levelStats = levels.map((lv: BetLevel, i: number) => {
          const resp = perJury.map(r => r.trace[i]).filter(t => t !== "?");
          const correct = resp.filter(t => t === "+").length;
          return { label: lv.label, concentration: lv.concentration, n: resp.length, correct };
        });

        return (
          <Card key={q.id} title={`Seuil 3-AFC (BET) — ${q.label}`}>
            <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ textAlign: "center", minWidth: "160px" }}>
                <div style={{ fontSize: "clamp(30px,4vw,44px)", fontWeight: 800, color: "#1a6b3a" }}>
                  {groupBET != null ? groupBET.toPrecision(3) : "—"}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>seuil de groupe (BET)</div>
                <div style={{ fontSize: "11px", color: "var(--mid)", marginTop: "4px", fontStyle: "italic" }}>
                  moyenne géométrique sur {valid.length} / {perJury.length} jurys
                </div>
              </div>

              <div style={{ flex: 1, minWidth: "260px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Réponses correctes par niveau</div>
                <table className="data-table">
                  <thead>
                    <tr><th>Niveau</th><th>Concentration</th><th>Correctes / N</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {levelStats.map((lv, i: number) => (
                      <tr key={i}>
                        <td>{lv.label || `niveau ${i + 1}`}</td>
                        <td className="num">{lv.concentration}</td>
                        <td className="num">{lv.correct} / {lv.n}</td>
                        <td className="num">{lv.n > 0 ? ((lv.correct / lv.n) * 100).toFixed(0) : "—"}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <details style={{ marginTop: "14px" }}>
              <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--mid)" }}>Détail par jury (ASTM E679)</summary>
              <table className="data-table" style={{ marginTop: "8px" }}>
                <thead>
                  <tr>
                    <th>Jury</th>
                    {levels.map((lv: BetLevel, i: number) => <th key={i} title={lv.label}>N{i + 1}</th>)}
                    <th>BET</th>
                  </tr>
                </thead>
                <tbody>
                  {perJury.map(r => (
                    <tr key={r.jury}>
                      <td>{r.jury}</td>
                      {r.trace.map((t, i) => (
                        <td key={i} className="num" style={{ color: t === "+" ? "#1a6b3a" : t === "-" ? "#c0392b" : "#888", fontWeight: 600 }}>
                          {t === "+" ? "✓" : t === "-" ? "✗" : "—"}
                        </td>
                      ))}
                      <td className="num">
                        {r.bet != null ? r.bet.toPrecision(3) : "—"}
                        {r.censored === "low" && <span style={{ fontSize: "10px", color: "var(--mid)" }}> (≤)</span>}
                        {r.censored === "high" && <span style={{ fontSize: "10px", color: "var(--mid)" }}> (≥)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: "11px", color: "var(--mid)", marginTop: "8px", fontStyle: "italic" }}>
                BET = moyenne géométrique des concentrations encadrant la dernière inversion (ASTM E679).
                (≤) : toutes réponses correctes, seuil censuré sous la plus faible concentration.
                (≥) : aucune réponse correcte, seuil censuré au-dessus de la plus forte concentration.
              </div>
            </details>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Toile d&apos;araignée (Radar) ──────────────────────────────────────────────────

function flattenRadarAnswers(ans: RadarAnswer, prefix = "", out: Record<string, number> = {}): Record<string, number> {
  if (!ans) return out;
  for (const [label, node] of Object.entries(ans)) {
    const fullLabel = prefix ? `${prefix} > ${label}` : label;
    if (node._ !== undefined && node._ !== null) {
      out[fullLabel] = node._;
    }
    if (node.children) {
      flattenRadarAnswers(node.children, fullLabel, out);
    }
  }
  return out;
}

function AnalyseRadar({ config, allAnswers }: { config: SessionConfig; allAnswers: AllAnswers }) {
  const radarQs = config.questions.filter(q => q.type === "radar");
  const products = config.products || [];
  const jurors = Object.keys(allAnswers);

  if (radarQs.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune donnée radar disponible.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {radarQs.map(q => (
        <RadarQuestionAnalysis key={q.id} question={q} products={products} jurors={jurors} allAnswers={allAnswers} />
      ))}
    </div>
  );
}

function RadarQuestionAnalysis({ question, products, jurors, allAnswers }: { question: Question; products: Product[]; jurors: string[]; allAnswers: AllAnswers }) {
  // Criteria par groupe (pour filtrer l'ACP) + liste globale
  const groups = question.radarGroups || [];
  const criteriaByGroup: Record<string, string[]> = {};
  const allCriteriaNames = new Set<string>();
  groups.forEach(g => {
    const acc: string[] = [];
    const walk = (axes: RadarAxis[], prefix = "") => {
      axes.forEach(ax => {
        const full = prefix ? `${prefix} > ${ax.label}` : ax.label;
        acc.push(full);
        allCriteriaNames.add(full);
        if (ax.children) walk(ax.children, full);
      });
    };
    walk(g.axes);
    criteriaByGroup[g.id] = acc;
  });
  const criteria = Array.from(allCriteriaNames);

  // Précalcul d'une map { jury → produit → crit → note } pour éviter de re-flatten à chaque accès.
  const noteMap = useMemo(() => {
    const map: Record<string, Record<string, Record<string, number>>> = {};
    for (const j of jurors) {
      const perProduct: Record<string, Record<string, number>> = {};
      for (const p of products) {
        const ja = allAnswers[j]?.[p.code]?.[question.id] as RadarAnswer | undefined;
        perProduct[p.code] = ja ? flattenRadarAnswers(ja) : {};
      }
      map[j] = perProduct;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jurors, products, question.id, allAnswers]);

  const getNote = (j: string, p: string, crit: string): number | null => {
    const v = noteMap[j]?.[p]?.[crit];
    return v == null ? null : v;
  };

  // Stats agrégées pré-calculées (évite des dizaines de filtres dans le rendu).
  const productStats = useMemo(() => {
    const stats: Record<string, Record<string, { mean: number; sd: number; n: number }>> = {};
    for (const p of products) {
      const perCrit: Record<string, { mean: number; sd: number; n: number }> = {};
      for (const j of jurors) {
        const flat = noteMap[j]?.[p.code] || {};
        for (const c of Object.keys(flat)) {
          if (!perCrit[c]) perCrit[c] = { mean: 0, sd: 0, n: 0 };
        }
      }
      for (const c of Object.keys(perCrit)) {
        const vals: number[] = [];
        for (const j of jurors) {
          const v = noteMap[j]?.[p.code]?.[c];
          if (typeof v === "number") vals.push(v);
        }
        const n = vals.length;
        const mean = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
        const sdv = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
        perCrit[c] = { mean, sd: sdv, n };
      }
      stats[p.code] = perCrit;
    }
    return stats;
  }, [products, jurors, noteMap]);

  const avg = (p: string, crit: string) => productStats[p]?.[crit]?.mean ?? 0;
  const sd = (p: string, crit: string) => productStats[p]?.[crit]?.sd ?? 0;

  // ── Niveau d'affichage / ACP — types et états (déclarés tôt pour être en scope partout) ──
  type PcaLevel = "famille" | "classe" | "descripteur";
  const [displayLevel, setDisplayLevel] = useState<PcaLevel>("famille");
  const [pcaLevel, setPcaLevel] = useState<PcaLevel>("descripteur");
  const [pcaGroupId, setPcaGroupId] = useState<string>(groups[0]?.id ?? "");
  const levelDepth: Record<PcaLevel, number> = { famille: 1, classe: 2, descripteur: 3 };
  const levelLabel: Record<PcaLevel, string> = {
    famille: "Famille",
    classe: "Classe",
    descripteur: "Descripteur",
  };
  const depthOf = (c: string) => c.split(" > ").length;

  // Performance individuelle
  const juryPerf = jurors.map(j => {
    const paired: Array<{ self: number; panel: number }> = [];
    const selfAll: number[] = [];
    products.forEach(p => {
      criteria.forEach(c => {
        const v = getNote(j, p.code, c);
        if (v !== null) {
          paired.push({ self: v, panel: avg(p.code, c) });
          selfAll.push(v);
        }
      });
    });
    const conf = paired.length >= 2 ? pearson(paired.map(x => x.self), paired.map(x => x.panel)) : 0;
    const range = selfAll.length ? Math.max(...selfAll) - Math.min(...selfAll) : 0;
    return { jury: j, conf, range, n: selfAll.length };
  }).sort((a, b) => b.conf - a.conf);

  // ANOVA par critère, restreint au niveau d'affichage choisi.
  const anovaCriteria = criteria.filter(c => {
    const groupId = groups.find(g => (criteriaByGroup[g.id] || []).includes(c))?.id;
    if (!groupId) return false;
    const groupCriteria = criteriaByGroup[groupId] || [];
    const isFlat = groupCriteria.length > 0 && groupCriteria.every(x => !x.includes(" > "));
    const lvl: PcaLevel = isFlat ? "famille" : displayLevel;
    return depthOf(c) === levelDepth[lvl];
  });
  const anovaRows = anovaCriteria.map(crit => {
    const mat: (number | null)[][] = products.map(p => jurors.map(j => getNote(j, p.code, crit)));
    const flat = mat.flat().filter((v): v is number => v !== null);
    const pN = products.length;
    const jN = jurors.length;
    if (flat.length < pN * jN || pN < 2 || jN < 2) return { crit, ok: false as const };
    
    const grand = flat.reduce((a, b) => a + b, 0) / flat.length;
    const prodMeans = mat.map(row => {
      const v = row.filter((x): x is number => x !== null);
      return v.reduce((a, b) => a + b, 0) / v.length;
    });
    const juryMeans = jurors.map((_, jIdx) => {
      const col = mat.map(row => row[jIdx]).filter((x): x is number => x !== null);
      return col.reduce((a, b) => a + b, 0) / col.length;
    });
    let ssProd = 0, ssJury = 0, ssTot = 0;
    for (let i = 0; i < pN; i++) ssProd += jN * (prodMeans[i] - grand) ** 2;
    for (let j = 0; j < jN; j++) ssJury += pN * (juryMeans[j] - grand) ** 2;
    for (let i = 0; i < pN; i++) for (let j = 0; j < jN; j++) {
      const v = mat[i][j];
      if (v !== null) ssTot += (v - grand) ** 2;
    }
    const ssErr = Math.max(0, ssTot - ssProd - ssJury);
    const dfProd = pN - 1, dfJury = jN - 1, dfErr = (pN - 1) * (jN - 1);
    const msProd = ssProd / dfProd, msJury = ssJury / dfJury, msErr = ssErr / dfErr;
    const fProd = msErr > 0 ? msProd / msErr : 0;
    const pProd = msErr > 0 ? fPValue(fProd, dfProd, dfErr) : 1;
    return { crit, ok: true as const, fProd, pProd };
  });

  // ACP — groupe (toile des arômes / profil gustatif / …)
  const activeGroup = groups.find(g => g.id === pcaGroupId) || groups[0];
  const scopeCriteria = activeGroup ? (criteriaByGroup[activeGroup.id] || []) : criteria;
  // Un groupe "plat" (ex. Profil gustatif : Acidité, Amertume, …) n'a qu'un niveau pertinent :
  // on masque alors le sélecteur de niveau et on force "famille".
  const isFlatGroup = scopeCriteria.length > 0 && scopeCriteria.every(c => !c.includes(" > "));
  const effectiveLevel: PcaLevel = isFlatGroup ? "famille" : pcaLevel;
  const pcaCriteria = scopeCriteria
    .filter(c => depthOf(c) === levelDepth[effectiveLevel])
    .filter(c => products.some(p => avg(p.code, c) > 0));
  const pcaMatrix = products.map(p => pcaCriteria.map(c => avg(p.code, c)));
  const canPca = products.length >= 3 && pcaCriteria.length >= 2;
  const pcaRes = canPca ? pca2D(pcaMatrix) : null;

  // Bornes symétriques pour normaliser les axes de la carte produits
  const scoreBound = pcaRes
    ? Math.max(0.5, ...pcaRes.scores.flatMap(s => [Math.abs(s[0]), Math.abs(s[1] ?? 0)])) * 1.1
    : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>{question.label}</h3>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", color: "var(--mid)", fontFamily: "'JetBrains Mono', ui-monospace, monospace", textTransform: "uppercase", letterSpacing: ".4px" }}>
          Niveau d&apos;affichage
        </span>
        <div className="pca-level-switch">
          {(["famille", "classe", "descripteur"] as const).map(lv => (
            <button
              key={lv}
              type="button"
              className={`pca-level-btn ${displayLevel === lv ? "active" : ""}`}
              onClick={() => setDisplayLevel(lv)}
            >
              {levelLabel[lv]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid2">
        {(question.radarGroups || []).map((g, gi) => {
          const groupCriteria: string[] = [];
          const walk = (axes: RadarAxis[], prefix = "") => {
            axes.forEach(ax => {
              const full = prefix ? `${prefix} > ${ax.label}` : ax.label;
              groupCriteria.push(full);
              if (ax.children) walk(ax.children, full);
            });
          };
          walk(g.axes);

          // Critères sélectionnés selon le niveau d'affichage. Les groupes "plats" (sans
          // hiérarchie, ex. profil gustatif) restent affichés tels quels au niveau famille.
          const isFlat = groupCriteria.length > 0 && groupCriteria.every(c => !c.includes(" > "));
          const effectiveDisplayLevel: PcaLevel = isFlat ? "famille" : displayLevel;
          const displayCriteria = groupCriteria
            .filter(c => depthOf(c) === levelDepth[effectiveDisplayLevel])
            .filter(c => products.some(p => avg(p.code, c) > 0));

          const radarData = {
            labels: displayCriteria.map(c => c.split(" > ").pop()),
            datasets: products.map((p, pi) => ({
              label: p.code,
              data: displayCriteria.map(c => avg(p.code, c)),
              borderColor: COLORS[pi % 8],
              backgroundColor: COLORS[pi % 8] + "22",
              pointBackgroundColor: COLORS[pi % 8],
            }))
          };

          return (
            <Card key={g.id} title={g.title}>
              <div className="analyse-radar-wrap">
                <Radar data={radarData} options={{ responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 10 } } }} />
              </div>
              <div style={{ marginTop: "20px" }}>
                <table className="data-table" style={{ fontSize: "11px" }}>
                  <thead>
                    <tr>
                      <th>Critère</th>
                      {products.map(p => <th key={p.code}>{p.code}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {displayCriteria.map(c => (
                      <tr key={c}>
                        <td style={{ paddingLeft: `${(c.split(" > ").length - 1) * 12}px`, color: c.includes(">") ? "var(--mid)" : "inherit", fontWeight: c.includes(">") ? 400 : 700 }}>
                          {c.split(" > ").pop()}
                        </td>
                        {products.map(p => {
                          const m = avg(p.code, c);
                          const s = sd(p.code, c);
                          return <td key={p.code} className="num" style={{ opacity: m > 0 ? 1 : 0.3 }}>
                            {m > 0 ? `${m.toFixed(1)} ±${s.toFixed(1)}` : "—"}
                          </td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Significativité des descripteurs (ANOVA)">
        <table className="data-table" style={{ fontSize: "12px" }}>
          <thead>
            <tr><th>Descripteur</th><th>F-produit</th><th>p-value</th></tr>
          </thead>
          <tbody>
            {anovaRows.filter(r => r.ok).map(r => (
              <tr key={r.crit}>
                <td>{r.crit}</td>
                <td className="num">{r.fProd.toFixed(2)}</td>
                <td className="num" style={{ fontWeight: r.pProd < 0.05 ? 700 : 400, color: r.pProd < 0.05 ? "#1a6b3a" : "inherit" }}>
                  {r.pProd < 0.001 ? "< 0,001" : r.pProd.toFixed(3)} {r.pProd < 0.05 ? "*" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {groups.length > 1 && (
          <>
            <span style={{ fontSize: "11px", color: "var(--mid)", fontFamily: "'JetBrains Mono', ui-monospace, monospace", textTransform: "uppercase", letterSpacing: ".4px" }}>
              Toile ACP
            </span>
            <select
              value={pcaGroupId}
              onChange={(e) => setPcaGroupId(e.target.value)}
              className="pca-group-select"
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </>
        )}
        {!isFlatGroup && (
          <>
            <span style={{ fontSize: "11px", color: "var(--mid)", fontFamily: "'JetBrains Mono', ui-monospace, monospace", textTransform: "uppercase", letterSpacing: ".4px" }}>
              Niveau ACP
            </span>
            <div className="pca-level-switch">
              {(["famille", "classe", "descripteur"] as const).map(lv => (
                <button
                  key={lv}
                  type="button"
                  className={`pca-level-btn ${pcaLevel === lv ? "active" : ""}`}
                  onClick={() => setPcaLevel(lv)}
                >
                  {levelLabel[lv]}
                </button>
              ))}
            </div>
          </>
        )}
        <span style={{ fontSize: "11px", color: "var(--mid)" }}>
          {pcaCriteria.length} {levelLabel[effectiveLevel].toLowerCase()}{pcaCriteria.length > 1 ? "s" : ""}
        </span>
      </div>

      {!pcaRes && (
        <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          Pas assez de données au niveau « {levelLabel[effectiveLevel].toLowerCase()} » pour calculer l&apos;ACP (il faut au moins 3 produits et 2 critères renseignés).
        </div>
      )}

      {pcaRes && (
        <div className="grid2">
          <Card title={`ACP — Carte des produits · ${activeGroup?.title || ""} (${levelLabel[effectiveLevel].toLowerCase()})`}>
            <div style={{ height: "320px" }}>
              <Scatter
                data={{
                  datasets: products.map((p, i) => ({
                    label: p.code,
                    data: [{ x: pcaRes.scores[i][0], y: pcaRes.scores[i][1], label: p.code }],
                    backgroundColor: COLORS[i % 8],
                    borderColor: COLORS[i % 8],
                    pointRadius: 7,
                    pointHoverRadius: 10,
                  }))
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  scales: {
                    x: { title: { display: true, text: `CP1 (${(pcaRes.explained[0]*100).toFixed(1)}%)` }, min: -scoreBound, max: scoreBound },
                    y: { title: { display: true, text: `CP2 (${((pcaRes.explained[1]||0)*100).toFixed(1)}%)` }, min: -scoreBound, max: scoreBound },
                  },
                  plugins: {
                    legend: { display: true, position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: { callbacks: { label: (ctx: TooltipItem<"scatter">) => {
                      const d = ctx.raw as { x: number; y: number; label: string };
                      return `${d.label}: (${d.x.toFixed(2)}, ${d.y.toFixed(2)})`;
                    } } }
                  }
                }}
              />
            </div>
            <div style={{ fontSize: "11px", color: "var(--mid)", marginTop: "10px" }}>
              CP1+CP2 : {((pcaRes.explained[0] + (pcaRes.explained[1]||0))*100).toFixed(1)}% de variance expliquée.
            </div>
          </Card>

          <Card title={`ACP — ${levelLabel[effectiveLevel]}s · ${activeGroup?.title || ""} (cercle des corrélations)`}>
            <div style={{ height: "320px" }}>
              <Scatter
                data={{
                  datasets: [
                    // Cercle unité
                    {
                      label: "_circle",
                      data: Array.from({ length: 65 }, (_, k) => {
                        const a = (k / 64) * 2 * Math.PI;
                        return { x: Math.cos(a), y: Math.sin(a) };
                      }),
                      borderColor: "rgba(120,120,120,0.35)",
                      borderWidth: 1,
                      borderDash: [3, 3],
                      pointRadius: 0,
                      showLine: true,
                      fill: false,
                    },
                    // Flèche fine (ligne + pointe triangulaire) par critère : (0,0) → (loading[0], loading[1])
                    ...pcaCriteria.map((c, i) => {
                      const lx = pcaRes.loadings[i][0];
                      const ly = pcaRes.loadings[i][1];
                      // Rotation du triangle (par défaut orienté vers le haut) pour suivre le vecteur
                      const rot = Math.atan2(lx, ly) * 180 / Math.PI;
                      return {
                        label: c.split(" > ").pop() as string,
                        data: [
                          { x: 0, y: 0 },
                          { x: lx, y: ly },
                        ],
                        borderColor: COLORS[i % 8],
                        backgroundColor: COLORS[i % 8],
                        borderWidth: 1,
                        pointStyle: ["circle", "triangle"] as Array<"circle" | "triangle">,
                        pointRadius: [0, 5],
                        pointHoverRadius: [0, 8],
                        pointRotation: [0, rot],
                        showLine: true,
                        fill: false,
                      };
                    }),
                  ],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  scales: {
                    x: { title: { display: true, text: `CP1 (${(pcaRes.explained[0]*100).toFixed(1)}%)` }, min: -1.1, max: 1.1 },
                    y: { title: { display: true, text: `CP2 (${((pcaRes.explained[1]||0)*100).toFixed(1)}%)` }, min: -1.1, max: 1.1 },
                  },
                  plugins: {
                    legend: {
                      display: true, position: "bottom",
                      labels: {
                        boxWidth: 12, font: { size: 10 },
                        filter: (item) => item.text !== "_circle",
                      },
                    },
                    tooltip: {
                      filter: (ctx) => ctx.dataset.label !== "_circle" && ctx.dataIndex === 1,
                      callbacks: {
                        label: (ctx: TooltipItem<"scatter">) => {
                          const d = ctx.raw as { x: number; y: number };
                          const r = Math.sqrt(d.x * d.x + d.y * d.y);
                          return `${ctx.dataset.label}: (${d.x.toFixed(2)}, ${d.y.toFixed(2)}) · r=${r.toFixed(2)}`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
            <div style={{ fontSize: "11px", color: "var(--mid)", marginTop: "10px" }}>
              Longueur de la flèche ≈ importance du critère sur le plan CP1-CP2 ; direction ≈ corrélation entre critères.
            </div>
          </Card>
        </div>
      )}

      <Card title="Performance du jury">
        <table className="data-table" style={{ fontSize: "12px" }}>
          <thead>
            <tr><th>Jury</th><th>Conformité (r)</th><th>Amplitude</th><th>Statut</th></tr>
          </thead>
          <tbody>
            {juryPerf.map(p => (
              <tr key={p.jury}>
                <td>{p.jury}</td>
                <td className="num" style={{ fontWeight: 700, color: p.conf > 0.6 ? "#1a6b3a" : p.conf > 0.3 ? "#c8820a" : "#c0392b" }}>
                  {p.conf.toFixed(2)}
                </td>
                <td className="num">{p.range.toFixed(1)}</td>
                <td>{p.conf > 0.6 ? "Conforme" : p.conf > 0.3 ? "Modéré" : "Discordant"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Nuage de mots ────────────────────────────────────────────────────────────

const STOP_WORDS = new Set(["le","la","les","de","du","des","un","une","en","et","à","au","aux","ce","se","sa","son","ses","je","tu","il","elle","nous","vous","ils","elles","que","qui","ne","pas","par","sur","avec","dans","est","sont","été","être","avoir","plus","ou","mais","donc","car","si","comme","tout","très","bien","aussi","pour","cette","cet","ces","leur","leurs","même","autre","autres","dont","peu","fait","faire","non","oui","ça","on","lui"]);

function buildWordFreq(rows: CSVRow[]): [string, number][] {
  const wordFreq: Record<string, number> = {};
  rows.forEach(r => {
    (r.valeur || "")
      .toLowerCase()
      .split(/[\s,;.!?''"()\[\]]+/)
      .map((w: string) => w.replace(/[^a-zàâäéèêëîïôùûüÿœæç-]/g, ""))
      .filter((w: string) => w.length > 2 && !STOP_WORDS.has(w))
      .forEach((w: string) => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
  });
  return Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 60);
}

function WordCloudDisplay({ rows, title }: { rows: CSVRow[]; title: string }) {
  const sorted = useMemo(() => buildWordFreq(rows), [rows]);
  const maxFreq = sorted[0]?.[1] || 1;
  if (sorted.length === 0) return null;
  return (
    <Card title={title}>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
        {rows.length} réponse{rows.length > 1 ? "s" : ""} · {sorted.length} mots distincts
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", padding: "16px", justifyContent: "center", alignItems: "center", lineHeight: 1.4 }}>
        {sorted.map(([word, freq]) => (
          <span
            key={word}
            title={`${freq} occurrence${freq > 1 ? "s" : ""}`}
            style={{
              fontSize: `${Math.round(11 + (freq / maxFreq) * 28)}px`,
              fontWeight: freq >= maxFreq * 0.6 ? 700 : freq >= maxFreq * 0.3 ? 600 : 400,
              color: wordColor(word),
              opacity: 0.55 + (freq / maxFreq) * 0.45,
              cursor: "default",
              transition: "opacity 0.15s",
            }}
          >
            {word}
          </span>
        ))}
      </div>
      <details style={{ marginTop: "12px" }}>
        <summary style={{ fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>Tableau des fréquences</summary>
        <table className="data-table" style={{ marginTop: "8px" }}>
          <thead><tr><th>Mot</th><th>Occurrences</th></tr></thead>
          <tbody>
            {sorted.slice(0, 20).map(([w, f]) => <tr key={w}><td>{w}</td><td className="num">{f}</td></tr>)}
          </tbody>
        </table>
      </details>
    </Card>
  );
}

function AnalyseWordCloud({ data, config }: { data: CSVRow[]; config?: SessionConfig }) {
  const textRows = data.filter(r => r.type === "text" && r.valeur && r.valeur.trim());
  const questionLabels = [...new Set(textRows.map(r => r.question))] as string[];

  if (textRows.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune réponse textuelle disponible.</div>;
  }

  const qs: Question[] = config?.questions || [];
  const products: Product[] = config?.products || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {questionLabels.map(qLabel => {
        const qConfig = qs.find((qq: Question) => qq.label === qLabel);
        const isPerProduct = qConfig?.scope === "per-product" && products.length > 0;
        const qRows = textRows.filter(r => r.question === qLabel);

        if (isPerProduct) {
          return (
            <div key={qLabel}>
              <div className="builder-section-label" style={{ marginBottom: "14px" }}>{qLabel}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                {products.map((p: Product) => {
                  const pRows = qRows.filter(r => r.produit === p.code);
                  if (pRows.length === 0) return null;
                  return (
                    <WordCloudDisplay key={p.code} rows={pRows} title={`${p.code}${p.label ? ` — ${p.label}` : ""}`} />
                  );
                })}
              </div>
            </div>
          );
        }

        return <WordCloudDisplay key={qLabel} rows={qRows} title={`Texte — ${qLabel}`} />;
      })}
    </div>
  );
}

// ─── Par jury ─────────────────────────────────────────────────────────────────

function AnalyseJury({ config, allAnswers }: { config: SessionConfig; allAnswers: AllAnswers }) {
  const jurors = Object.keys(allAnswers || {});
  if (jurors.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucun jury enregistré.</div>;
  }

  const qs: Question[] = config.questions || [];
  const products: Product[] = config.products || [];
  const ppQ = qs.filter(q => q.scope === "per-product");

  return (
    <Card title="Avancement par jury">
      <table className="data-table">
        <thead>
          <tr>
            <th>Jury</th>
            {products.map(p => <th key={p.code}>{p.code}</th>)}
            {qs.filter(q => ["classement","seuil","seuil-bet","triangulaire","duo-trio","a-non-a"].includes(q.type)).map(q => (
              <th key={q.id} style={{ maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis" }} title={q.label}>
                {q.label.length > 12 ? q.label.slice(0, 10) + "…" : q.label}
              </th>
            ))}
            <th>Global</th>
          </tr>
        </thead>
        <tbody>
          {jurors.map(j => {
            const ja = allAnswers[j] || {};
            return (
              <tr key={j}>
                <td style={{ fontWeight: 600 }}>{j}</td>
                {products.map(p => {
                  const pa = ja[p.code] || {};
                  const answered = ppQ.some(q => pa[q.id] != null);
                  return (
                    <td key={p.code} style={{ textAlign: "center", color: answered ? "#1a6b3a" : "#c0392b", fontWeight: 600 }}>
                      {answered ? "✓" : "✗"}
                    </td>
                  );
                })}
                {qs.filter(q => ["classement","seuil","seuil-bet","triangulaire","duo-trio","a-non-a"].includes(q.type)).map(q => {
                  const section = q.type === "classement" || q.type === "seuil" ? "_rank" : "_discrim";
                  const answered = ja[section]?.[q.id] != null;
                  return (
                    <td key={q.id} style={{ textAlign: "center", color: answered ? "#1a6b3a" : "#c0392b", fontWeight: 600 }}>
                      {answered ? "✓" : "✗"}
                    </td>
                  );
                })}
                <td style={{ textAlign: "center", color: ja["_global"] && Object.keys(ja["_global"]).length > 0 ? "#1a6b3a" : "#c0392b", fontWeight: 600 }}>
                  {ja["_global"] && Object.keys(ja["_global"]).length > 0 ? "✓" : "✗"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Données brutes ───────────────────────────────────────────────────────────

function computeResultat(r: CSVRow): string {
  if (!r.correct || !r.valeur) return "";
  const type: string = r.type || "";
  if (type === "scale" || type === "text" || type === "seuil-bet") return "";
  if (type === "a-non-a") {
    // valeur is JSON string of {code: "A"|"non-A"}, correct is "CODE:A,CODE2:non-A"
    try {
      const valObj: Record<string, string> = JSON.parse(r.valeur);
      const corrObj: Record<string, string> = Object.fromEntries(
        r.correct.split(",").map((p: string) => p.split(":")).filter((a: string[]) => a.length === 2)
      );
      const codes = Object.keys(corrObj);
      if (codes.length === 0) return "";
      const allCorrect = codes.every(c => valObj[c] === corrObj[c]);
      const someCorrect = codes.some(c => valObj[c] === corrObj[c]);
      return allCorrect ? "✓" : someCorrect ? "~" : "✗";
    } catch { return ""; }
  }
  return String(r.valeur) === String(r.correct) ? "✓" : "✗";
}

function AnalyseDonnees({ data }: { data: CSVRow[] }) {
  if (data.length === 0) return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune donnée.</div>;

  const enriched: Record<string, string | undefined>[] = data.map(r => ({ ...r, résultat: computeResultat(r) }));
  const headers = Object.keys(enriched[0]);

  return (
    <Card title="Données brutes">
      <div style={{ overflowX: "auto", maxHeight: "500px", overflowY: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {enriched.slice(0, 200).map((r, i) => (
              <tr key={i}>{headers.map(h => (
                <td key={h} style={h === "résultat" ? {
                  textAlign: "center",
                  fontWeight: 700,
                  color: r[h] === "✓" ? "var(--ok)" : r[h] === "✗" ? "var(--danger)" : r[h] === "~" ? "var(--warn)" : undefined
                } : undefined}>
                  {r[h]}
                </td>
              ))}</tr>
            ))}
          </tbody>
        </table>
        {data.length > 200 && (
          <div style={{ padding: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
            Affichage des 200 premières lignes sur {data.length}. Exportez le CSV pour tout voir.
          </div>
        )}
      </div>
    </Card>
  );
}
