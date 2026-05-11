"use client";
import React from "react";
import { Bar } from "react-chartjs-2";
import { Card } from "../../ui/Card";
import { AnalysisEmpty, AnalysisStack, OK_TEXT, significanceClass } from "../../ui/AnalysisPrimitives";
import { chiSquarePValue, getNemenyiCD, computeCLD, kendallTau, kendallW } from "../../../lib/stats";
import type { SessionConfig, CSVRow, Product } from "../../../types";
import { getChartColors } from "./utils";

interface AnalyseFriedmanProps {
  config: SessionConfig;
  data: CSVRow[];
  type: "classement" | "seuil";
  questionLabel: string;
}

export function AnalyseFriedman({ config, data, type, questionLabel }: AnalyseFriedmanProps) {
  const rankRows = data.filter(r => r.type === type && r.valeur && r.question === questionLabel);
  const title = type === "seuil" ? "Seuil" : "Classement";

  if (rankRows.length === 0) {
    return <AnalysisEmpty>Aucune donnée de {type} disponible.</AnalysisEmpty>;
  }

  const qRows = rankRows.filter(r => r.question === questionLabel && r.valeur);
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
      <Card title={`${title} — ${questionLabel}`}>
        <p className="text-[var(--text-muted)] text-[13px]">
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
    const initialGroup = "a";
    thresholdProduct = sortedByMeanLocal.find(p => {
      const letters = cld[p] || "";
      return !letters.includes(initialGroup);
    }) || null;
  }

  // Bar chart data — rank means (lower = better rank)
  const sortedByMean = [...products].sort((a, b) => rankMeans[a] - rankMeans[b]);
  const chartColors = getChartColors();
  const barData = {
    labels: sortedByMean,
    datasets: [{
      label: "Rang moyen",
      data: sortedByMean.map((p: string) => parseFloat(rankMeans[p].toFixed(2))),
      backgroundColor: sortedByMean.map((_, i) => chartColors[i % chartColors.length] + "cc"),
      borderColor: sortedByMean.map((_, i) => chartColors[i % chartColors.length]),
      borderWidth: 1,
    }]
  };

  return (
    <AnalysisStack>
      <Card title={`${title} — ${questionLabel}`}>
        <div className="flex gap-6 flex-wrap items-start">
          <div className="flex-[1_1_260px] max-w-[360px]">
            <Bar
              data={barData}
              options={{
                indexAxis: "y" as const,
                scales: { x: { beginAtZero: true, max: k, title: { display: true, text: "Rang moyen (1 = 1er)" } } },
                plugins: { legend: { display: false } },
              }}
            />
          </div>
          <div className="flex-[1_1_200px]">
            <table className="data-table">
              <thead>
                <tr><th>Produit</th><th>Rang moyen</th>{pValue < 0.05 && <th>Gr.</th>}</tr>
              </thead>
              <tbody>
                {sortedByMean.map(p => (
                  <tr key={p}>
                    <td className="font-mono">{p}</td>
                    <td className="num">{rankMeans[p].toFixed(2)}</td>
                    {pValue < 0.05 && <td className="text-center font-bold text-[var(--accent)]">{cld[p]}</td>}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 px-3.5 py-3 bg-[var(--bg)] rounded-lg text-[13px] leading-[1.8]">
              <div><strong>Test de Friedman</strong> (α=0,05)</div>
              <div>n = {n} jurys · k = {k} produits</div>
              <div>χ² = {chi2.toFixed(3)} · p = {pValue < 0.001 ? "< 0,001" : pValue.toFixed(3)} <span className={significanceClass(pValue < 0.05)}>{sig}</span></div>
              <div title="Coefficient de concordance de Kendall — cohérence inter-jurys du panel. 1 = accord parfait, 0 = désaccord total.">
                <span className="text-[var(--text-muted)]">W de Kendall (concordance panel) = </span>
                <span className={`font-semibold ${panelW >= 0.7 ? OK_TEXT : panelW >= 0.4 ? "text-[#8a6d00]" : "text-[var(--danger)]"}`}>
                  {panelW.toFixed(2)}
                </span>
              </div>

              {pValue < 0.05 && (
                <div className="mt-3">
                  <strong>Post-hoc de Nemenyi</strong> (α=0,10)
                  <div className="text-[11px] text-[var(--text-muted)]">Différence Critique (CD) = {nemenyiCD.toFixed(2)}</div>
                  <div className="text-[11px] text-[#1a6b3a] italic mb-2">
                    Les produits partageant une même lettre ne sont pas significativement différents.
                  </div>

                  <details>
                    <summary className="cursor-pointer text-xs text-[var(--mid)]">Afficher les comparaisons par paires</summary>
                    <table className="data-table mt-2 text-[11px]">
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
                                <td className={isSig ? "font-bold text-[var(--danger)]" : "font-normal text-[var(--mid)]"}>
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
                <div className="mt-3 p-2.5 bg-[var(--paper2)] border-l-4 border-[var(--accent)] rounded">
                  <strong>Conclusion Seuil</strong>
                  <div>L&apos;échantillon marquant le seuil est : <strong>{thresholdProduct}</strong></div>
                  {config?.products?.find((p: Product) => p.code === thresholdProduct)?.label && (
                    <div className="text-xs text-[var(--mid)] italic mt-1">
                      Descripteurs : {config.products.find((p: Product) => p.code === thresholdProduct)?.label}
                    </div>
                  )}
                </div>
              )}

              {correctProducts.length > 0 && (
                <div className="mt-3 border-t border-[var(--border)] pt-2">
                  <strong>Conformité à l&apos;ordre attendu</strong>
                  <div>{matchCount} / {n} jurys exacts ({(matchCount / n * 100).toFixed(0)}%)</div>
                  <div title="τ de Kendall — concordance en paires avec l'ordre attendu. 1 = identique, 0 = aléatoire, -1 = inverse.">
                    τ de Kendall moyen = <span className="font-semibold">{avgTau.toFixed(2)}</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">Attendu : {correctProducts.join(" > ")}</div>
                </div>
              )}
            </div>
          </div>
        </div>
        {type === "seuil" && (
           <details className="mt-4">
             <summary className="cursor-pointer text-xs text-[var(--mid)]">Afficher la distribution des rangs</summary>
             <div className="mt-2.5 flex gap-5 flex-wrap">
                <table className="data-table flex-1">
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
    </AnalysisStack>
  );
}
