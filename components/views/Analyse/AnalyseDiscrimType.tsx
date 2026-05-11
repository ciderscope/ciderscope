"use client";
import React from "react";
import { Card } from "../../ui/Card";
import {
  AnalysisEmpty,
  AnalysisStack,
  MetricLayout,
  MetricBlock,
  AnalysisPanel,
  TableCaption,
  DetailTable,
  OK_TEXT,
  DANGER_TEXT,
  DIM_TEXT,
  significanceClass
} from "../../ui/AnalysisPrimitives";
import { binomialPValue, chiSquarePValue, normalInvCDF } from "../../../lib/stats";
import type { CSVRow } from "../../../types";

interface AnalyseDiscrimTypeProps {
  data: CSVRow[];
  type: string;
  label: string;
  questionLabel: string;
}

const parseCodeMap = (value: string | undefined): Record<string, string> => {
  const raw = value?.trim();
  if (!raw) return {};

  if (raw.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [k, v as string])
        );
      }
    } catch {
      return {};
    }
  }

  return Object.fromEntries(
    raw
      .split(",")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [code, ...answerParts] = part.split(":");
        return [code.trim(), answerParts.join(":").trim()] as const;
      })
      .filter(([code, answer]) => code && answer)
  );
};

export function AnalyseDiscrimType({ data, type, label, questionLabel }: AnalyseDiscrimTypeProps) {
  const dd = data.filter(r => r.type === type && r.question === questionLabel);

  if (dd.length === 0) {
    return <AnalysisEmpty>Aucune donnée disponible.</AnalysisEmpty>;
  }

  // Binomial test p-value (exact, one-sided)
  // P(X >= k | n, p_chance) where p_chance = 1/3 for triangulaire, 1/2 for duo-trio, varies for a-non-a
  const pChance = type === "triangulaire" ? 1 / 3 : type === "duo-trio" ? 1 / 2 : 0.5;

  // Minimum correct answers for significance (p<0.05, one-sided)
  const minCorrect = (n: number, p: number): number => {
    for (let k = n; k >= 0; k--) {
      if (binomialPValue(n, k, p) >= 0.05) return k + 1;
    }
    return 0;
  };

  if (type === "a-non-a") {
    const qd = dd.filter(r => r.question === questionLabel);
    // Agrégation en table 2×2 : lignes = stimulus (A / non-A), colonnes = réponse (A / non-A)
    let hits = 0, misses = 0, fa = 0, cr = 0;
    const perJury: Array<{ jury: string; hit: number; miss: number; fa: number; cr: number }> = [];
    qd.forEach(r => {
      const val = parseCodeMap(r.valeur);
      const cor = parseCodeMap(r.correct);
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

    // Interprétation pédagogique de d' (Green & Swets, Macmillan & Creelman)
    const dInterp = Math.abs(dPrime) < 0.5 ? "très faible" : Math.abs(dPrime) < 1 ? "faible" : Math.abs(dPrime) < 1.5 ? "modérée" : Math.abs(dPrime) < 2.5 ? "forte" : "très forte";

    return (
      <Card title={`${label} — ${questionLabel}`}>
        <MetricLayout compact>
          <MetricBlock
            minClass="min-w-[140px]"
            value={<>d&apos; = {dPrime.toFixed(2)}</>}
            label="indice de discrimination"
            note={dInterp}
            valueClassName={`text-[clamp(36px,5vw,52px)] font-extrabold ${pVal < 0.05 ? OK_TEXT : DIM_TEXT}`}
            noteClassName={`mt-1 text-[13px] italic ${pVal < 0.05 ? OK_TEXT : DIM_TEXT}`}
          />

          <div className="min-w-[260px] flex-1">
            <TableCaption>Table 2×2 agrégée</TableCaption>
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
                  <td className={`num font-semibold ${OK_TEXT}`}>{hits} <span className="text-[10px] text-[var(--text-muted)]">(hit)</span></td>
                  <td className={`num ${DANGER_TEXT}`}>{misses} <span className="text-[10px] text-[var(--text-muted)]">(miss)</span></td>
                  <td className="num">{nA}</td>
                </tr>
                <tr>
                  <td><strong>Stimulus non-A</strong></td>
                  <td className={`num ${DANGER_TEXT}`}>{fa} <span className="text-[10px] text-[var(--text-muted)]">(FA)</span></td>
                  <td className={`num font-semibold ${OK_TEXT}`}>{cr} <span className="text-[10px] text-[var(--text-muted)]">(CR)</span></td>
                  <td className="num">{nNonA}</td>
                </tr>
              </tbody>
            </table>
            <AnalysisPanel className="mt-2.5">
              <div>Taux de détection (hit rate) : <strong>{(H * 100).toFixed(1)}%</strong></div>
              <div>Taux de fausse alarme : <strong>{(F * 100).toFixed(1)}%</strong></div>
              <div>χ² (Yates, ddl=1) = {chi2.toFixed(2)} &middot; p = {pVal < 0.001 ? "< 0,001" : pVal.toFixed(3)} <span className={significanceClass(pVal < 0.05)}>{sig}</span></div>
              {pVal < 0.05
                ? <div className={`mt-1 font-semibold ${OK_TEXT}`}>Discrimination significative entre A et non-A (α=0,05)</div>
                : <div className={`mt-1 ${DANGER_TEXT}`}>Pas de différence détectée (α=0,05)</div>}
            </AnalysisPanel>
          </div>
        </MetricLayout>

        <DetailTable summary="Détail par jury">
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
        </DetailTable>
      </Card>
    );
  }

  const qd = dd.filter(r => r.question === questionLabel);
  const n = qd.length;
  const nc = qd.filter(r => r.valeur === r.correct).length;

  const pVal = binomialPValue(n, nc, pChance);
  const sig = pVal < 0.001 ? "***" : pVal < 0.01 ? "**" : pVal < 0.05 ? "*" : "ns";
  const minC = minCorrect(n, pChance);
  const pct = n ? (nc / n * 100).toFixed(0) : 0;

  return (
    <AnalysisStack>
      <Card title={`${label} — ${questionLabel}`}>
        <MetricLayout>
          <MetricBlock
            value={nc}
            label="réponses correctes"
            note={`${pct}%`}
            valueClassName={`text-[clamp(36px,5vw,52px)] font-extrabold ${nc >= minC ? OK_TEXT : DIM_TEXT}`}
            noteClassName={`mt-1.5 text-[22px] font-bold not-italic ${pVal < 0.05 ? OK_TEXT : DIM_TEXT}`}
          />

          <div className="min-w-[200px] flex-1">
            <AnalysisPanel loose>
              <div><strong>Test binomial</strong> (unilatéral)</div>
              <div>Probabilité chance : {(pChance * 100).toFixed(0)}%</div>
              <div>Seuil de signification (p&lt;0,05) : ≥ {minC} bonnes réponses</div>
              <div>
                p = {pVal < 0.001 ? "< 0,001" : pVal.toFixed(3)}
                {" "}
                <span className={significanceClass(pVal < 0.05)}>{sig}</span>
              </div>
              {pVal < 0.05
                ? <div className={`mt-1 font-semibold ${OK_TEXT}`}>
                    Le panel discrimine significativement les produits (α=0,05)
                  </div>
                : <div className={`mt-1 ${DANGER_TEXT}`}>
                    Pas de différence détectée (α=0,05)
                  </div>
              }
            </AnalysisPanel>

            <TableCaption className="mt-3">Détail par jury</TableCaption>
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
                      <td className="font-mono text-[11px]">
                        {typeof r.valeur === "string" && r.valeur.length > 30
                          ? r.valeur.slice(0, 30) + "…"
                          : r.valeur}
                      </td>
                      <td className={correct ? `font-semibold ${OK_TEXT}` : `font-semibold ${DANGER_TEXT}`}>
                        {correct ? "✓" : "✗"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </MetricLayout>
      </Card>
    </AnalysisStack>
  );
}
