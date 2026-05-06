"use client";
import React, { useState, useMemo, Fragment } from "react";
import { Radar, Scatter } from "react-chartjs-2";
import type { TooltipItem } from "chart.js";
import { Card } from "../../ui/Card";
import {
  AnalysisEmpty,
  AnalysisStack,
  ANALYSIS_TOOLBAR,
  ANALYSIS_CHART_BOX,
  ToolbarLabel,
  OK_TEXT,
  confidenceClass
} from "../../ui/AnalysisPrimitives";
import { anovaTwoWay, pca2D, rvCoefficient } from "../../../lib/stats";
import type { SessionConfig, AllAnswers, Question, Product, RadarAxis, RadarAnswer } from "../../../types";
import { getChartColors, pearson, flattenRadarAnswers } from "./utils";

interface AnalyseRadarProps {
  config: SessionConfig;
  allAnswers: AllAnswers;
  participantMode?: boolean;
  currentJuror?: string;
}

export function AnalyseRadar({ config, allAnswers, participantMode, currentJuror }: AnalyseRadarProps) {
  const radarQs = config.questions.filter(q => q.type === "radar");
  const products = config.products || [];
  const jurors = Object.keys(allAnswers);

  if (radarQs.length === 0) {
    return <AnalysisEmpty>Aucune donnée radar disponible.</AnalysisEmpty>;
  }

  return (
    <AnalysisStack deep>
      {radarQs.map(q => (
        <RadarQuestionAnalysis key={q.id} question={q} products={products} jurors={jurors} allAnswers={allAnswers} participantMode={participantMode} currentJuror={currentJuror} />
      ))}
    </AnalysisStack>
  );
}

function RadarQuestionAnalysis({ question, products, jurors, allAnswers, participantMode, currentJuror }: { question: Question; products: Product[]; jurors: string[]; allAnswers: AllAnswers; participantMode?: boolean; currentJuror?: string }) {
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
    
    // Pour le coefficient RV, on prépare les matrices [Produits x Critères]
    const judgeMat: number[][] = products.map(p => 
      criteria.map(c => getNote(j, p.code, c) ?? avg(p.code, c)) // Imputation par la moyenne si manque
    );
    const panelMat: number[][] = products.map(p => 
      criteria.map(c => avg(p.code, c))
    );
    
    const rv = products.length >= 2 && criteria.length >= 2 ? rvCoefficient(judgeMat, panelMat) : null;

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
    return { jury: j, conf, rv, range, n: selfAll.length };
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
    const mat: (number | null)[][] = products.map(p => jurors.map(j => getNote(j, p.code, crit) ?? avg(p.code, crit)));
    const res = anovaTwoWay(mat);
    return { crit, ...res };
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
    <AnalysisStack>
      <h3 className="m-0 text-lg font-bold">{question.label}</h3>

      <div className={ANALYSIS_TOOLBAR}>
        <ToolbarLabel>Niveau d&apos;affichage</ToolbarLabel>
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
        {(question.radarGroups || []).map((g) => {
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
              borderColor: getChartColors()[pi % 8],
              backgroundColor: getChartColors()[pi % 8] + "22",
              pointBackgroundColor: getChartColors()[pi % 8],
            }))
          };

          const jurorRadarData = (participantMode && currentJuror) ? {
            labels: displayCriteria.map(c => c.split(" > ").pop()),
            datasets: products.map((p, pi) => ({
              label: p.code,
              data: displayCriteria.map(c => getNote(currentJuror, p.code, c) ?? 0),
              borderColor: getChartColors()[pi % 8],
              backgroundColor: getChartColors()[pi % 8] + "22",
              pointBackgroundColor: getChartColors()[pi % 8],
            }))
          } : null;

          return (
            <Fragment key={g.id}>
              <Card title={participantMode ? `${g.title} (Moyenne globale)` : g.title}>
                <div className="analyse-radar-wrap">
                  <Radar data={radarData} options={{ responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 10 } } }} />
                </div>
                {!participantMode && (
                  <div className="mt-5">
                    <table className="data-table text-[11px]">
                      <thead>
                        <tr>
                          <th>Critère</th>
                          {products.map(p => <th key={p.code}>{p.code}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {displayCriteria.map(c => (
                          <tr key={c}>
                            <td
                              className={c.includes(">") ? "font-normal text-[var(--mid)]" : "font-bold"}
                              style={{ paddingLeft: `${(c.split(" > ").length - 1) * 12}px` }}
                            >
                              {c.split(" > ").pop()}
                            </td>
                            {products.map(p => {
                              const m = avg(p.code, c);
                              const s = sd(p.code, c);
                              return <td key={p.code} className={`num ${m > 0 ? "opacity-100" : "opacity-30"}`}>
                                {m > 0 ? `${m.toFixed(1)} ±${s.toFixed(1)}` : "—"}
                              </td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
              {jurorRadarData && (
                <Card title={`${g.title} (Vos réponses)`}>
                  <div className="analyse-radar-wrap">
                    <Radar data={jurorRadarData} options={{ responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 10 } } }} />
                  </div>
                </Card>
              )}
            </Fragment>
          );
        })}
      </div>

      {!participantMode && (
        <Card title="Significativité des descripteurs (ANOVA)">
          <table className="data-table text-xs">
            <thead>
              <tr><th>Descripteur</th><th>F-produit</th><th>p-value</th></tr>
            </thead>
            <tbody>
              {anovaRows.filter(r => r.ok).map(r => (
                <tr key={r.crit}>
                  <td>{r.crit}</td>
                  <td className="num">{r.fProd.toFixed(2)}</td>
                  <td className={`num ${r.pProd < 0.05 ? `font-bold ${OK_TEXT}` : "font-normal"}`}>
                    {r.pProd < 0.001 ? "< 0,001" : r.pProd.toFixed(3)} {r.pProd < 0.05 ? "*" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className={ANALYSIS_TOOLBAR}>
        {groups.length > 1 && (
          <>
            <ToolbarLabel>Toile ACP</ToolbarLabel>
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
            <ToolbarLabel>Niveau ACP</ToolbarLabel>
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
        <span className="text-[11px] text-[var(--mid)]">
          {pcaCriteria.length} {levelLabel[effectiveLevel].toLowerCase()}{pcaCriteria.length > 1 ? "s" : ""}
        </span>
      </div>

      {!pcaRes && (
        <div className="text-[13px] text-[var(--text-muted)]">
          Pas assez de données au niveau « {levelLabel[effectiveLevel].toLowerCase()} » pour calculer l&apos;ACP (il faut au moins 3 produits et 2 critères renseignés).
        </div>
      )}

      {pcaRes && (
        <div className="grid2">
          <Card title={`ACP — Carte des produits · ${activeGroup?.title || ""} (${levelLabel[effectiveLevel].toLowerCase()})`}>
            <div className={ANALYSIS_CHART_BOX}>
              <Scatter
                data={{
                  datasets: products.map((p, i) => ({
                    label: p.code,
                    data: [{ x: pcaRes.scores[i][0], y: pcaRes.scores[i][1], label: p.code }],
                    backgroundColor: getChartColors()[i % 8],
                    borderColor: getChartColors()[i % 8],
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
            <div className="mt-2.5 text-[11px] text-[var(--mid)]">
              CP1+CP2 : {((pcaRes.explained[0] + (pcaRes.explained[1]||0))*100).toFixed(1)}% de variance expliquée.
            </div>
          </Card>

          <Card title={`ACP — ${levelLabel[effectiveLevel]}s · ${activeGroup?.title || ""} (cercle des corrélations)`}>
            <div className={ANALYSIS_CHART_BOX}>
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
                        borderColor: getChartColors()[i % 8],
                        backgroundColor: getChartColors()[i % 8],
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
            <div className="mt-2.5 text-[11px] text-[var(--mid)]">
              Longueur de la flèche ≈ importance du critère sur le plan CP1-CP2 ; direction ≈ corrélation entre critères.
            </div>
          </Card>
        </div>
      )}

      {!participantMode && (
        <Card title="Performance du jury">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>Jury</th>
                <th title="Corrélation de Pearson entre le juge et la moyenne du panel">R-Pearson</th>
                <th title="Coefficient RV : corrélation multidimensionnelle entre le juge et le panel (plus robuste)">Coeff. RV</th>
                <th>Amplitude</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {juryPerf.map(p => (
                <tr key={p.jury}>
                  <td>{p.jury}</td>
                  <td className={`num font-bold ${confidenceClass(p.conf)}`}>
                    {p.conf.toFixed(2)}
                  </td>
                  <td className={`num ${p.rv !== null && p.rv > 0.6 ? OK_TEXT : ""}`}>
                    {p.rv !== null ? p.rv.toFixed(2) : "—"}
                  </td>
                  <td className="num">{p.range.toFixed(1)}</td>
                  <td>{p.conf > 0.6 ? "Conforme" : p.conf > 0.3 ? "Modéré" : "Discordant"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AnalysisStack>
  );
}
