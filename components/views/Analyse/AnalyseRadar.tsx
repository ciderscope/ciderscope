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
  ANALYSIS_NUM_CELL,
  ANALYSIS_RADAR_WRAP,
  ANALYSIS_TABLE_CLASS,
  PCA_GROUP_SELECT_CLASS,
  ToolbarLabel,
  OK_TEXT,
  confidenceClass
} from "../../ui/AnalysisPrimitives";
import { rvCoefficient, dravnieksScore, pcaCovariance } from "../../../lib/stats";
import { analyzeAttributes, HrataObservation } from "../../../lib/hrata";
import type { SessionConfig, AllAnswers, Question, Product, RadarAxis, RadarAnswer } from "../../../types";
import { getChartColors, pearson, flattenRadarAnswers } from "./utils";

interface AnalyseRadarProps {
  config: SessionConfig;
  allAnswers: AllAnswers;
  participantMode?: boolean;
  currentJuror?: string;
}

const grid2Class = "grid2 grid min-w-0 grid-cols-2 gap-4 [&>*]:min-w-0 max-[900px]:grid-cols-1 max-[480px]:gap-2.5 min-[1600px]:grid-cols-3";
const pcaLevelSwitchClass = "pca-level-switch inline-flex overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--paper)] max-[480px]:max-w-full max-[480px]:flex-wrap";
const pcaLevelBtnClass = (active: boolean) => [
  "pca-level-btn border-0 bg-transparent px-3.5 py-1.5 text-xs font-medium text-[var(--ink)] transition-all duration-100 hover:bg-[var(--paper2)] [&:not(:last-child)]:border-r [&:not(:last-child)]:border-[var(--border)] max-[480px]:min-w-0 max-[480px]:px-2.5 max-[480px]:text-[11.5px]",
  active ? "active bg-[var(--ink)] text-white hover:bg-[var(--ink)]" : "",
].filter(Boolean).join(" ");

const getRadarAnswer = (answers: AllAnswers[string] | undefined, productCode: string, questionId: string): RadarAnswer | undefined => {
  const section = answers?.[productCode];
  if (!section || typeof section !== "object" || Array.isArray(section)) return undefined;
  const value = (section as Record<string, unknown>)[questionId];
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as RadarAnswer;
};

export function AnalyseRadar({ config, allAnswers, participantMode, currentJuror }: AnalyseRadarProps) {
  const radarQs = config.questions.filter(q => q.type === "radar");
  const products = config.products || [];
  const jurors = useMemo(() => Object.keys(allAnswers), [allAnswers]);

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
  const groups = useMemo(() => question.radarGroups || [], [question.radarGroups]);
  const { criteriaByGroup, criteria } = useMemo(() => {
    const byGroup: Record<string, string[]> = {};
    const allNames = new Set<string>();
    groups.forEach(g => {
      const acc: string[] = [];
      const walk = (axes: RadarAxis[], prefix = "") => {
        axes.forEach(ax => {
          const full = prefix ? `${prefix} > ${ax.label}` : ax.label;
          acc.push(full);
          allNames.add(full);
          if (ax.children) walk(ax.children, full);
        });
      };
      walk(g.axes);
      byGroup[g.id] = acc;
    });
    return { criteriaByGroup: byGroup, criteria: Array.from(allNames) };
  }, [groups]);
  const chartColors = getChartColors();

  // Précalcul d'une map { jury → produit → crit → note } pour éviter de re-flatten à chaque accès.
  const noteMap = useMemo(() => {
    const map: Record<string, Record<string, Record<string, number>>> = {};
    for (const j of jurors) {
      const perProduct: Record<string, Record<string, number>> = {};
      for (const p of products) {
        const ja = getRadarAnswer(allAnswers[j], p.code, question.id);
        perProduct[p.code] = ja ? flattenRadarAnswers(ja) : {};
      }
      map[j] = perProduct;
    }
    return map;
  }, [jurors, products, question.id, allAnswers]);

  // ── Niveau d'affichage / ACP — types et états (déclarés tôt pour être en scope partout) ──
  type PcaLevel = "famille" | "classe" | "descripteur";
  const [displayLevel, setDisplayLevel] = useState<PcaLevel>("famille");
  const [pcaLevel, setPcaLevel] = useState<PcaLevel>("descripteur");
  const [pcaGroupId, setPcaGroupId] = useState<string>(groups[0]?.id ?? "");
  const adaptiveScale = true;
  const levelDepth: Record<PcaLevel, number> = { famille: 1, classe: 2, descripteur: 3 };
  const levelLabel: Record<PcaLevel, string> = { famille: "Famille", classe: "Classe", descripteur: "Descripteur" };
  const depthOf = (c: string) => c.split(" > ").length;

  const hrataAnalyses = useMemo(() => {
    const obs: HrataObservation[] = [];
    jurors.forEach(j => {
      products.forEach(p => {
        criteria.forEach(c => {
          const val = noteMap[j]?.[p.code]?.[c];
          let lvl: "famille" | "classe" | "descripteur" = "descripteur";
          const depth = depthOf(c);
          if (depth === 1) lvl = "famille";
          if (depth === 2) lvl = "classe";
          obs.push({
            subjectId: j,
            productId: p.code,
            attributeId: c,
            attributeLevel: lvl,
            intensity: val ?? null
          });
        });
      });
    });
    return analyzeAttributes(obs, {
      minSubjects: Math.max(2, Math.floor(jurors.length * 0.15)), // 15% of panel, min 2
      minCoverageRate: 0.15,
      minPositiveSelections: 2,
      maxIntensityScale: 10
    });
  }, [jurors, products, criteria, noteMap]);

  // Imputation HRATA : seuls les attributs cités (> 0) définissent le sous-panel
  // qui a réellement considéré l'attribut. Les zéros par défaut restent NC.
  const citedAtLeastOnce = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const c of criteria) {
      map[c] = new Set<string>();
      for (const j of jurors) {
        for (const p of products) {
          const value = noteMap[j]?.[p.code]?.[c];
          if (typeof value === "number" && value > 0) {
            map[c].add(j);
            break; // found for this juror
          }
        }
      }
    }
    return map;
  }, [criteria, jurors, products, noteMap]);

  const getNote = (j: string, p: string, crit: string): number | null => {
    const v = noteMap[j]?.[p]?.[crit];
    if (v != null) return v;
    if (citedAtLeastOnce[crit]?.has(j)) return 0; // Imputation
    return null;
  };

  // Stats agrégées pré-calculées
  const productStats = useMemo(() => {
    const stats: Record<string, Record<string, { mean: number; sd: number; n: number }>> = {};
    for (const p of products) {
      const perCrit: Record<string, { mean: number; sd: number; n: number }> = {};
      for (const c of criteria) {
        const vals: number[] = [];
        for (const j of jurors) {
          let v = noteMap[j]?.[p.code]?.[c];
          if (v == null && citedAtLeastOnce[c]?.has(j)) v = 0; // Imputation
          if (v != null) vals.push(v);
        }
        const n = vals.length;
        const mean = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
        const sdv = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
        perCrit[c] = { mean, sd: sdv, n };
      }
      stats[p.code] = perCrit;
    }
    return stats;
  }, [products, jurors, noteMap, criteria, citedAtLeastOnce]);

  const avg = (p: string, crit: string) => productStats[p]?.[crit]?.mean ?? 0;
  const sd = (p: string, crit: string) => productStats[p]?.[crit]?.sd ?? 0;

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

  // ACP — groupe (toile des arômes / profil gustatif / …)
  const activeGroup = groups.find(g => g.id === pcaGroupId) || groups[0];
  const scopeCriteria = activeGroup ? (criteriaByGroup[activeGroup.id] || []) : criteria;
  // Un groupe "plat" (ex. Profil gustatif : Acidité, Amertume, …) n'a qu'un niveau pertinent :
  // on masque alors le sélecteur de niveau et on force "famille".
  const isFlatGroup = scopeCriteria.length > 0 && scopeCriteria.every(c => !c.includes(" > "));
  const effectiveLevel: PcaLevel = isFlatGroup ? "famille" : pcaLevel;
  // Moyenne globale d'un critère (toutes notes ≥ 0 confondues, sur tous les produits)
  // — utilisée pour ne garder que les 9 critères les plus marqués aux niveaux
  // classe / descripteur où la liste peut devenir illisible.
  const overallMean = (c: string) => {
    if (products.length === 0) return 0;
    let s = 0;
    for (const p of products) s += avg(p.code, c);
    return s / products.length;
  };
  const TOP_N = 9;
  const pcaCriteriaAll = scopeCriteria
    .filter(c => depthOf(c) === levelDepth[effectiveLevel])
    .filter(c => products.some(p => avg(p.code, c) > 0));
  const pcaCriteria = effectiveLevel === "famille"
    ? pcaCriteriaAll
    : [...pcaCriteriaAll].sort((a, b) => overallMean(b) - overallMean(a)).slice(0, TOP_N);
    
  const pcaMatrix = products.map(p => pcaCriteria.map(c => {
    let freq = 0;
    let sumInt = 0;
    const maxSumInt = jurors.length * 10;
    jurors.forEach(j => {
      const v = getNote(j, p.code, c);
      if (v && v > 0) {
        freq++;
        sumInt += v;
      }
    });
    return dravnieksScore(freq, jurors.length, sumInt, maxSumInt);
  }));

  const canPca = products.length >= 3 && pcaCriteria.length >= 2;
  const pcaRes = canPca ? pcaCovariance(pcaMatrix) : null;

  // Bornes symétriques pour normaliser les axes de la carte produits
  const scoreBound = pcaRes
    ? Math.max(0.5, ...pcaRes.scores.flatMap(s => [Math.abs(s[0]), Math.abs(s[1] ?? 0)])) * 1.1
    : 1;

  return (
    <AnalysisStack>
      <h3 className="m-0 text-lg font-bold">{question.label}</h3>

      <div className={ANALYSIS_TOOLBAR}>
        <ToolbarLabel>Niveau d&apos;affichage</ToolbarLabel>
        <div className={pcaLevelSwitchClass}>
          {(["famille", "classe", "descripteur"] as const).map(lv => (
            <button
              key={lv}
              type="button"
              className={pcaLevelBtnClass(displayLevel === lv)}
              onClick={() => setDisplayLevel(lv)}
            >
              {levelLabel[lv]}
            </button>
          ))}
        </div>
      </div>

      <div className={grid2Class}>
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
          const displayCriteriaAll = groupCriteria
            .filter(c => depthOf(c) === levelDepth[effectiveDisplayLevel])
            .filter(c => products.some(p => avg(p.code, c) > 0));
          // Quel que soit le niveau, on cape à TOP_N (9) critères en triant
          // par moyenne globale décroissante : les nuls sont déjà exclus par
          // le filtre `avg > 0` ci-dessus, donc on n'affiche que les plus
          // marqués jusqu'à 9 max — radar lisible et homogène entre niveaux.
          const displayCriteria = [...displayCriteriaAll]
            .sort((a, b) => overallMean(b) - overallMean(a))
            .slice(0, TOP_N);

          const radarData = {
            labels: displayCriteria.map(c => c.split(" > ").pop()),
            datasets: products.map((p, pi) => ({
              label: p.code,
              data: displayCriteria.map(c => avg(p.code, c)),
              borderColor: chartColors[pi % chartColors.length],
              backgroundColor: chartColors[pi % chartColors.length] + "22",
              pointBackgroundColor: chartColors[pi % chartColors.length],
            }))
          };

          const jurorRadarData = (participantMode && currentJuror) ? {
            labels: displayCriteria.map(c => c.split(" > ").pop()),
            datasets: products.map((p, pi) => ({
              label: p.code,
              data: displayCriteria.map(c => getNote(currentJuror, p.code, c) ?? 0),
              borderColor: chartColors[pi % chartColors.length],
              backgroundColor: chartColors[pi % chartColors.length] + "22",
              pointBackgroundColor: chartColors[pi % chartColors.length],
            }))
          } : null;

          // Borne maximale de l'axe radial : pleine échelle (10) par défaut, ou
          // recadrée sur la plage utile en mode adaptatif pour révéler les
          // faibles intensités. On combine moyennes panel + notes individuelles
          // (mode participant) pour ne jamais tronquer la courbe.
          const computeMax = (allValues: number[]): number => {
            if (!adaptiveScale) return 10;
            const top = allValues.length ? Math.max(...allValues) : 0;
            if (top <= 0) return 1;
            return Math.min(10, Math.max(1, Math.ceil(top * 1.2)));
          };
          const panelValues = displayCriteria.flatMap(c => products.map(p => avg(p.code, c)));
          const radarMax = computeMax(panelValues);
          const jurorValues = jurorRadarData
            ? displayCriteria.flatMap(c => products.map(p => getNote(currentJuror!, p.code, c) ?? 0))
            : [];
          const jurorMax = computeMax(jurorValues);
          // Options communes : on désactive explicitement le rectangle gris
          // derrière les graduations (backdrop) pour garantir un rendu
          // identique entre admin et résumé participant, indépendamment
          // de l'instant où syncChartDefaults() a été exécuté. Pas de
          // graduations décimales (i.e. "0,5" en français) — pour les petits
          // max, step=1 ; au-delà, step=2 pour rester lisible.
          const buildOpts = (max: number) => {
            const stepSize = max <= 5 ? 1 : 2;
            return {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                r: {
                  beginAtZero: true,
                  max,
                  ticks: {
                    showLabelBackdrop: false,
                    backdropColor: "transparent" as const,
                    stepSize,
                    precision: 0,
                  },
                },
              },
            };
          };

          return (
            <Fragment key={g.id}>
              <Card title={participantMode ? `${g.title} (Moyenne globale)` : g.title}>
                <div className={ANALYSIS_RADAR_WRAP}>
                  <Radar data={radarData} options={buildOpts(radarMax)} />
                </div>
                {!participantMode && (
                  <div className="mt-5">
                    <table className={`${ANALYSIS_TABLE_CLASS} text-[11px]`}>
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
                              return <td key={p.code} className={`${ANALYSIS_NUM_CELL} ${m > 0 ? "opacity-100" : "opacity-30"}`}>
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
                  <div className={ANALYSIS_RADAR_WRAP}>
                    <Radar data={jurorRadarData} options={buildOpts(jurorMax)} />
                  </div>
                </Card>
              )}
            </Fragment>
          );
        })}
      </div>

      {!participantMode && hrataAnalyses && (
        <Card title={`Rapport d'Analyse HRATA · ${activeGroup?.title || ""}`}>
          <table className={`${ANALYSIS_TABLE_CLASS} text-[11px]`}>
            <thead>
              <tr>
                <th>Attribut</th>
                <th title="Sujets ayant utilisé l'attribut / Total Panel">Couverture</th>
                <th title="Sélections positives / Nb obs. conditionnelles">Fréq. Cond.</th>
                <th title="Moyenne conditionnelle (incluant les zéros imputés)">Intensité Cond.</th>
                <th title="Score pondéré par la couverture">Dravnieks (Pond.)</th>
                <th title="p-value (FDR) de l'effet produit sur la fréquence (Q Cochran)">p (Fréquence)</th>
                <th title="p-value (FDR) de l'effet produit sur l'intensité positive dans le traitement HRATA">p (Intensité)</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {hrataAnalyses.filter(a => scopeCriteria.includes(a.attributeId)).map(a => (
                <tr key={a.attributeId} className={a.isLowCoverage ? "opacity-50" : ""}>
                  <td className={a.attributeId.includes(">") ? "font-normal text-[var(--mid)]" : "font-bold"} style={{ paddingLeft: `${(a.attributeId.split(" > ").length - 1) * 12}px` }}>
                    {a.attributeId.split(" > ").pop()}
                  </td>
                  <td className={ANALYSIS_NUM_CELL}>{a.subjectsConsidering}/{a.totalSubjects} ({(a.coverageRate * 100).toFixed(0)}%)</td>
                  <td className={ANALYSIS_NUM_CELL}>{(a.conditionalFrequency * 100).toFixed(1)}%</td>
                  <td className={ANALYSIS_NUM_CELL}>{a.conditionalMeanIntensity.toFixed(2)}</td>
                  <td className={`${ANALYSIS_NUM_CELL} font-bold`}>{a.dravnieksWeighted.toFixed(1)}</td>
                  <td className={`${ANALYSIS_NUM_CELL} ${a.pApplicabilityFDR !== undefined && a.pApplicabilityFDR < 0.05 ? OK_TEXT + ' font-bold' : ''}`}>
                    {a.pApplicabilityFDR !== undefined ? (a.pApplicabilityFDR < 0.001 ? "< 0,001" : a.pApplicabilityFDR.toFixed(3)) : "—"}
                  </td>
                  <td className={`${ANALYSIS_NUM_CELL} ${a.pIntensityFDR !== undefined && a.pIntensityFDR < 0.05 ? OK_TEXT + ' font-bold' : ''}`}>
                    {a.pIntensityFDR !== undefined ? (a.pIntensityFDR < 0.001 ? "< 0,001" : a.pIntensityFDR.toFixed(3)) : "—"}
                  </td>
                  <td>{a.status}</td>
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
              className={PCA_GROUP_SELECT_CLASS}
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
            <div className={pcaLevelSwitchClass}>
              {(["famille", "classe", "descripteur"] as const).map(lv => (
                <button
                  key={lv}
                  type="button"
                  className={pcaLevelBtnClass(pcaLevel === lv)}
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
        <div className={grid2Class}>
          <Card title={`ACP — Carte des produits · ${activeGroup?.title || ""} (${levelLabel[effectiveLevel].toLowerCase()})`}>
            <div className={ANALYSIS_CHART_BOX}>
              <Scatter
                data={{
                  datasets: products.map((p, i) => ({
                    label: p.code,
                    data: [{ x: pcaRes.scores[i][0], y: pcaRes.scores[i][1], label: p.code }],
                    backgroundColor: chartColors[i % chartColors.length],
                    borderColor: chartColors[i % chartColors.length],
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
                        borderColor: chartColors[i % chartColors.length],
                        backgroundColor: chartColors[i % chartColors.length],
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
          <table className={ANALYSIS_TABLE_CLASS}>
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
                  <td className={`${ANALYSIS_NUM_CELL} font-bold ${confidenceClass(p.conf)}`}>
                    {p.conf.toFixed(2)}
                  </td>
                  <td className={`${ANALYSIS_NUM_CELL} ${p.rv !== null && p.rv > 0.6 ? OK_TEXT : ""}`}>
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
