"use client";
import React, { useEffect, useMemo, useRef, useState, Fragment } from "react";
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
import { supabase } from "../../../lib/supabase";
import { applyRadarAxisCorrection, buildRadarDisplayAxes, FRUITY_RADAR_DISPLAY_PRESET, type RadarDisplayAxis } from "../../../lib/radarDisplayPreset";

interface AnalyseRadarProps {
  config: SessionConfig;
  allAnswers: AllAnswers;
  sessionId?: string;
  participantMode?: boolean;
  currentJuror?: string;
}

const grid2Class = "grid2 grid min-w-0 grid-cols-1 gap-4 [&>*]:min-w-0 max-[480px]:gap-2.5 min-[901px]:grid-cols-[repeat(var(--analysis-panel-cols-lg),minmax(0,1fr))] min-[1600px]:grid-cols-[repeat(var(--analysis-panel-cols-wide),minmax(0,1fr))]";
const pcaLevelSwitchClass = "pca-level-switch inline-flex overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--paper)] max-[480px]:max-w-full max-[480px]:flex-wrap";
const pcaLevelBtnClass = (active: boolean) => [
  "pca-level-btn border-0 bg-transparent px-3.5 py-1.5 text-xs font-medium text-[var(--ink)] transition-all duration-100 hover:bg-[var(--paper2)] [&:not(:last-child)]:border-r [&:not(:last-child)]:border-[var(--border)] max-[480px]:min-w-0 max-[480px]:px-2.5 max-[480px]:text-[11.5px]",
  active ? "active bg-[var(--ink)] text-white hover:bg-[var(--ink)]" : "",
].filter(Boolean).join(" ");
const radarModeBtnClass = (active: boolean) => [
  "border-0 bg-transparent px-3.5 py-1.5 text-xs font-medium text-[var(--ink)] transition-all duration-100 hover:bg-[var(--paper2)] [&:not(:last-child)]:border-r [&:not(:last-child)]:border-[var(--border)] max-[480px]:min-w-0 max-[480px]:px-2.5 max-[480px]:text-[11.5px]",
  active ? "!bg-[var(--ink)] !text-white hover:!bg-[var(--ink)]" : "",
].filter(Boolean).join(" ");
const radarLegendClass = "mt-3 flex flex-wrap items-center justify-center gap-2";
const radarLegendItemClass = "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--paper2)] px-2 text-xs text-[var(--ink)] transition-colors hover:border-[var(--accent)]";
const radarLegendCheckClass = "h-4 w-4 cursor-pointer accent-[var(--accent)]";
const radarLegendSwatchClass = "inline-flex h-6 min-w-8 max-w-44 items-center justify-center overflow-hidden rounded px-2 font-mono text-[11px] font-bold leading-none shadow-sm";
const radarLegendAllLabelClass = `${radarLegendItemClass} bg-[var(--paper)] font-mono text-[10px] font-semibold uppercase tracking-[0.3px] text-[var(--mid)]`;

type HiddenLegendMap = Record<string, Record<string, boolean>>;
type ChartLegendItem = { id: string; label: string; color: string; visible: boolean };
type RadarDisplayMode = "standard" | typeof FRUITY_RADAR_DISPLAY_PRESET.id;
type RadarPanel = { id: string; title: string; displayAxes: RadarDisplayAxis[]; fixedScale: boolean };
type CorrectionSaveStatus = "idle" | "saving" | "saved" | "error";
type RadarCorrectionSettings = Record<string, Record<string, Record<string, number>>>;

const RADAR_CORRECTIONS_SETTINGS_KEY = "radarCorrectionFactors";
const radarChartWithCorrectionsClass = "grid grid-cols-[minmax(280px,460px)_minmax(220px,280px)] items-center gap-4";
const radarCorrectionPanelClass = "rounded-md border border-[var(--border)] bg-[var(--paper2)] p-3";
const radarCorrectionTitleClass = "mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.4px] text-[var(--mid)]";
const radarCorrectionRowsClass = "flex flex-col gap-2";
const radarCorrectionRowClass = "grid grid-cols-[minmax(0,1fr)_96px] items-center gap-2";
const radarCorrectionLabelClass = "min-w-0 truncate text-xs font-medium text-[var(--ink)]";
const radarCorrectionInputClass = "h-8 w-full rounded-md border border-[var(--border)] bg-[var(--paper)] px-2 text-right font-mono text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]";
const radarCorrectionStatusClass: Record<CorrectionSaveStatus, string> = {
  idle: "text-[var(--mid)]",
  saving: "text-[#8a5a00]",
  saved: "text-[#1a6b3a]",
  error: "text-[#c0392b]",
};

const radarPanelGridStyle = (itemCount: number) => ({
  "--analysis-panel-cols-lg": Math.max(1, Math.min(itemCount, 2)),
  "--analysis-panel-cols-wide": Math.max(1, Math.min(itemCount, 3)),
} as React.CSSProperties);

function getSwatchTextColor(color: string): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (!match) return "#ffffff";
  const [, r, g, b] = match;
  const luminance = (0.299 * parseInt(r, 16) + 0.587 * parseInt(g, 16) + 0.114 * parseInt(b, 16)) / 255;
  return luminance > 0.58 ? "#1a1a1a" : "#ffffff";
}

function ToggleAllCheckbox({ checked, indeterminate, onChange, ariaLabel }: { checked: boolean; indeterminate: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className={radarLegendCheckClass}
      checked={checked}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.currentTarget.checked)}
    />
  );
}

function ChartToggleLegend({
  items,
  ariaLabel,
  allAriaLabel,
  itemAriaLabel,
  onToggle,
  onToggleAll,
}: {
  items: ChartLegendItem[];
  ariaLabel: string;
  allAriaLabel: string;
  itemAriaLabel: (label: string) => string;
  onToggle: (id: string, visible: boolean) => void;
  onToggleAll: (visible: boolean) => void;
}) {
  const allVisible = items.length > 0 && items.every(item => item.visible);
  const someVisible = items.some(item => item.visible);

  return (
    <div className={radarLegendClass} aria-label={ariaLabel}>
      <label className={radarLegendAllLabelClass} title={allAriaLabel}>
        <ToggleAllCheckbox
          checked={allVisible}
          indeterminate={someVisible && !allVisible}
          ariaLabel={allAriaLabel}
          onChange={onToggleAll}
        />
        Tous
      </label>
      {items.map(item => (
        <label key={item.id} className={`${radarLegendItemClass} ${item.visible ? "" : "opacity-50"}`} title={itemAriaLabel(item.label)}>
          <input
            type="checkbox"
            className={radarLegendCheckClass}
            checked={item.visible}
            aria-label={itemAriaLabel(item.label)}
            onChange={(e) => onToggle(item.id, e.currentTarget.checked)}
          />
          <span className={radarLegendSwatchClass} style={{ backgroundColor: item.color, color: getSwatchTextColor(item.color) }}>
            <span className="truncate">{item.label}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeCorrectionSettings(value: unknown): RadarCorrectionSettings {
  if (!isRecord(value)) return {};
  const out: RadarCorrectionSettings = {};

  for (const [questionId, byPreset] of Object.entries(value)) {
    if (!isRecord(byPreset)) continue;
    const presetOut: Record<string, Record<string, number>> = {};
    for (const [presetId, byAxis] of Object.entries(byPreset)) {
      if (!isRecord(byAxis)) continue;
      const axisOut: Record<string, number> = {};
      for (const [axisLabel, raw] of Object.entries(byAxis)) {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (Number.isFinite(n)) axisOut[axisLabel] = n;
      }
      presetOut[presetId] = axisOut;
    }
    out[questionId] = presetOut;
  }

  return out;
}

function getCorrectionValue(corrections: RadarCorrectionSettings, questionId: string, presetId: string, axisLabel: string): number {
  return corrections[questionId]?.[presetId]?.[axisLabel] ?? 0;
}

function formatCorrectionInput(value: number): string {
  return value === 0 ? "1.00" : value.toFixed(2);
}

function correctionStatusLabel(status: CorrectionSaveStatus): string {
  if (status === "saving") return "Enregistrement...";
  if (status === "saved") return "Enregistré";
  if (status === "error") return "Erreur de sauvegarde";
  return "Correction multiplicative";
}

function RadarCorrectionControls({
  axes,
  questionId,
  presetId,
  corrections,
  status,
  onChange,
}: {
  axes: RadarDisplayAxis[];
  questionId: string;
  presetId: string;
  corrections: RadarCorrectionSettings;
  status: CorrectionSaveStatus;
  onChange: (questionId: string, presetId: string, axisLabel: string, value: number) => void;
}) {
  return (
    <div className={radarCorrectionPanelClass}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className={radarCorrectionTitleClass}>Correction</div>
        <div className={`text-[10px] ${radarCorrectionStatusClass[status]}`}>
          {correctionStatusLabel(status)}
        </div>
      </div>
      <div className={radarCorrectionRowsClass}>
        {axes.map(axis => {
          const value = getCorrectionValue(corrections, questionId, presetId, axis.label);
          return (
            <label key={axis.label} className={radarCorrectionRowClass}>
              <span className={radarCorrectionLabelClass}>{axis.label}</span>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={formatCorrectionInput(value)}
                onChange={(e) => {
                  const raw = e.currentTarget.value;
                  const next = raw === "" ? 0 : Number(raw);
                  onChange(questionId, presetId, axis.label, Number.isFinite(next) ? next : 0);
                }}
                className={radarCorrectionInputClass}
                aria-label={`Correction ${axis.label}`}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

const getRadarAnswer = (answers: AllAnswers[string] | undefined, productCode: string, questionId: string): RadarAnswer | undefined => {
  const section = answers?.[productCode];
  if (!section || typeof section !== "object" || Array.isArray(section)) return undefined;
  const value = (section as Record<string, unknown>)[questionId];
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as RadarAnswer;
};

export function AnalyseRadar({ config, allAnswers, sessionId, participantMode, currentJuror }: AnalyseRadarProps) {
  const radarQs = config.questions.filter(q => q.type === "radar");
  const products = config.products || [];
  const jurors = useMemo(() => Object.keys(allAnswers), [allAnswers]);
  const [radarCorrections, setRadarCorrections] = useState<RadarCorrectionSettings>({});
  const [correctionSaveStatus, setCorrectionSaveStatus] = useState<CorrectionSaveStatus>("idle");
  const analysisSettingsRef = useRef<Record<string, unknown>>({});
  const radarCorrectionsRef = useRef<RadarCorrectionSettings>({});
  const correctionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (participantMode || !sessionId) {
      return;
    }

    let cancelled = false;
    const loadCorrections = async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("analysis_settings")
        .eq("id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Erreur lors du chargement des corrections radar:", error);
        setCorrectionSaveStatus("error");
        return;
      }

      const row = data as { analysis_settings?: unknown } | null;
      const settings = isRecord(row?.analysis_settings) ? row.analysis_settings : {};
      const nextCorrections = normalizeCorrectionSettings(settings[RADAR_CORRECTIONS_SETTINGS_KEY]);
      analysisSettingsRef.current = settings;
      radarCorrectionsRef.current = nextCorrections;
      setRadarCorrections(nextCorrections);
      setCorrectionSaveStatus("idle");
    };

    void loadCorrections();
    return () => { cancelled = true; };
  }, [participantMode, sessionId]);

  useEffect(() => {
    return () => {
      if (correctionSaveTimerRef.current) clearTimeout(correctionSaveTimerRef.current);
    };
  }, []);

  const scheduleCorrectionSave = (nextCorrections: RadarCorrectionSettings) => {
    if (participantMode || !sessionId) return;
    if (correctionSaveTimerRef.current) clearTimeout(correctionSaveTimerRef.current);
    setCorrectionSaveStatus("saving");

    correctionSaveTimerRef.current = setTimeout(() => {
      correctionSaveTimerRef.current = null;
      const nextSettings = {
        ...analysisSettingsRef.current,
        [RADAR_CORRECTIONS_SETTINGS_KEY]: nextCorrections,
      };

      void supabase
        .from("sessions")
        .update({ analysis_settings: nextSettings })
        .eq("id", sessionId)
        .then(({ error }) => {
          if (error) {
            console.error("Erreur lors de l'enregistrement des corrections radar:", error);
            setCorrectionSaveStatus("error");
            return;
          }
          analysisSettingsRef.current = nextSettings;
          setCorrectionSaveStatus("saved");
        });
    }, 400);
  };

  const setRadarCorrection = (questionId: string, presetId: string, axisLabel: string, value: number) => {
    const correction = Number.isFinite(value) ? value : 0;
    const prev = radarCorrectionsRef.current;
    const next = {
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [presetId]: {
          ...(prev[questionId]?.[presetId] || {}),
          [axisLabel]: correction,
        },
      },
    };
    radarCorrectionsRef.current = next;
    setRadarCorrections(next);
    scheduleCorrectionSave(next);
  };

  if (radarQs.length === 0) {
    return <AnalysisEmpty>Aucune donnée radar disponible.</AnalysisEmpty>;
  }

  return (
    <AnalysisStack deep>
      {radarQs.map(q => (
        <RadarQuestionAnalysis
          key={q.id}
          question={q}
          products={products}
          jurors={jurors}
          allAnswers={allAnswers}
          participantMode={participantMode}
          currentJuror={currentJuror}
          radarCorrections={radarCorrections}
          correctionSaveStatus={correctionSaveStatus}
          onCorrectionChange={setRadarCorrection}
        />
      ))}
    </AnalysisStack>
  );
}

function RadarQuestionAnalysis({
  question,
  products,
  jurors,
  allAnswers,
  participantMode,
  currentJuror,
  radarCorrections,
  correctionSaveStatus,
  onCorrectionChange,
}: {
  question: Question;
  products: Product[];
  jurors: string[];
  allAnswers: AllAnswers;
  participantMode?: boolean;
  currentJuror?: string;
  radarCorrections: RadarCorrectionSettings;
  correctionSaveStatus: CorrectionSaveStatus;
  onCorrectionChange: (questionId: string, presetId: string, axisLabel: string, value: number) => void;
}) {
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
  const [displayMode, setDisplayMode] = useState<RadarDisplayMode>("standard");
  const [pcaLevel, setPcaLevel] = useState<PcaLevel>("descripteur");
  const [pcaGroupId, setPcaGroupId] = useState<string>(groups[0]?.id ?? "");
  const [hiddenProductsByChart, setHiddenProductsByChart] = useState<HiddenLegendMap>({});
  const [hiddenCriteriaByChart, setHiddenCriteriaByChart] = useState<HiddenLegendMap>({});
  const adaptiveScale = true;
  const levelDepth: Record<PcaLevel, number> = { famille: 1, classe: 2, descripteur: 3 };
  const levelLabel: Record<PcaLevel, string> = { famille: "Famille", classe: "Classe", descripteur: "Descripteur" };
  const depthOf = (c: string) => c.split(" > ").length;
  const isProductVisible = (chartKey: string, productCode: string) => hiddenProductsByChart[chartKey]?.[productCode] !== true;
  const isCriteriaVisible = (chartKey: string, criteriaId: string) => hiddenCriteriaByChart[chartKey]?.[criteriaId] !== true;
  const legendItemsFor = (chartKey: string): ChartLegendItem[] => products.map((p, pi) => ({
    id: p.code,
    label: p.code,
    color: chartColors[pi % chartColors.length],
    visible: isProductVisible(chartKey, p.code),
  }));
  const criteriaLegendItemsFor = (chartKey: string, criteriaList: string[]): ChartLegendItem[] => criteriaList.map((c, i) => ({
    id: c,
    label: c.split(" > ").pop() || c,
    color: chartColors[i % chartColors.length],
    visible: isCriteriaVisible(chartKey, c),
  }));
  const setLegendItemVisible = (
    setHiddenMap: React.Dispatch<React.SetStateAction<HiddenLegendMap>>,
    chartKey: string,
    itemId: string,
    visible: boolean
  ) => {
    setHiddenMap(prev => {
      const nextForChart = { ...(prev[chartKey] || {}) };
      if (visible) delete nextForChart[itemId];
      else nextForChart[itemId] = true;
      return { ...prev, [chartKey]: nextForChart };
    });
  };
  const setAllLegendItemsVisible = (
    setHiddenMap: React.Dispatch<React.SetStateAction<HiddenLegendMap>>,
    chartKey: string,
    itemIds: string[],
    visible: boolean
  ) => {
    setHiddenMap(prev => ({
      ...prev,
      [chartKey]: visible
        ? {}
        : itemIds.reduce<Record<string, boolean>>((acc, itemId) => {
            acc[itemId] = true;
            return acc;
          }, {}),
    }));
  };
  const setProductVisible = (chartKey: string, productCode: string, visible: boolean) => {
    setLegendItemVisible(setHiddenProductsByChart, chartKey, productCode, visible);
  };
  const setAllProductsVisible = (chartKey: string, visible: boolean) => {
    setAllLegendItemsVisible(setHiddenProductsByChart, chartKey, products.map(product => product.code), visible);
  };
  const setCriteriaVisible = (chartKey: string, criteriaId: string, visible: boolean) => {
    setLegendItemVisible(setHiddenCriteriaByChart, chartKey, criteriaId, visible);
  };
  const setAllCriteriaVisible = (chartKey: string, criteriaIds: string[], visible: boolean) => {
    setAllLegendItemsVisible(setHiddenCriteriaByChart, chartKey, criteriaIds, visible);
  };

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
    if (depthOf(crit) !== 3 || citedAtLeastOnce[crit]?.has(j)) return 0; // Imputation
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
  const fixedScaleMax = Math.max(1, question.max ?? 10);
  const specialRadarAxes = useMemo(
    () => buildRadarDisplayAxes(criteria, FRUITY_RADAR_DISPLAY_PRESET),
    [criteria]
  );
  const buildStandardRadarAxes = (axes: RadarAxis[]): RadarDisplayAxis[] => {
    const groupCriteria: string[] = [];
    const walk = (items: RadarAxis[], prefix = "") => {
      items.forEach(ax => {
        const full = prefix ? `${prefix} > ${ax.label}` : ax.label;
        groupCriteria.push(full);
        if (ax.children) walk(ax.children, full);
      });
    };
    walk(axes);

    const isFlat = groupCriteria.length > 0 && groupCriteria.every(c => !c.includes(" > "));
    const effectiveDisplayLevel: PcaLevel = isFlat ? "famille" : displayLevel;
    const displayCriteriaAll = groupCriteria
      .filter(c => depthOf(c) === levelDepth[effectiveDisplayLevel])
      .filter(c => products.some(p => avg(p.code, c) > 0));

    return [...displayCriteriaAll]
      .sort((a, b) => overallMean(b) - overallMean(a))
      .slice(0, TOP_N)
      .map(c => ({ id: c, label: c.split(" > ").pop() || c, matched: true }));
  };
  const useSpecialRadarDisplay = !participantMode && displayMode === FRUITY_RADAR_DISPLAY_PRESET.id;
  const radarPanels: RadarPanel[] = useSpecialRadarDisplay
    ? [{
        id: FRUITY_RADAR_DISPLAY_PRESET.id,
        title: FRUITY_RADAR_DISPLAY_PRESET.label,
        displayAxes: specialRadarAxes,
        fixedScale: FRUITY_RADAR_DISPLAY_PRESET.fixedScale,
      }]
    : groups.map(g => ({
        id: g.id,
        title: g.title,
        displayAxes: buildStandardRadarAxes(g.axes),
        fixedScale: false,
      }));
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
  const pcaLegendScope = `${question.id}:${activeGroup?.id || "all"}:${effectiveLevel}`;
  const pcaProductLegendKey = `${pcaLegendScope}:pca-products`;
  const pcaCriteriaLegendKey = `${pcaLegendScope}:pca-criteria`;
  const radarPanelItemCount = radarPanels.length * (participantMode && currentJuror ? 2 : 1);

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
        {!participantMode && (
          <>
            <ToolbarLabel>Modèle radar</ToolbarLabel>
            <div className={pcaLevelSwitchClass}>
              <button
                type="button"
                className={radarModeBtnClass(displayMode === "standard")}
                onClick={() => setDisplayMode("standard")}
              >
                Standard
              </button>
              <button
                type="button"
                className={radarModeBtnClass(displayMode === FRUITY_RADAR_DISPLAY_PRESET.id)}
                onClick={() => setDisplayMode(FRUITY_RADAR_DISPLAY_PRESET.id)}
              >
                7 axes fruités
              </button>
            </div>
          </>
        )}
      </div>

      <div className={grid2Class} style={radarPanelGridStyle(radarPanelItemCount)}>
        {radarPanels.map((panel) => {
          const panelRadarKey = `${question.id}:${panel.id}:panel`;
          const jurorRadarKey = `${question.id}:${panel.id}:juror`;
          const isCorrectionPanel = !participantMode && panel.id === FRUITY_RADAR_DISPLAY_PRESET.id;
          const correctedPanelValue = (productCode: string, axis: RadarDisplayAxis): number => {
            const raw = avg(productCode, axis.id);
            if (!isCorrectionPanel) return raw;
            const correction = getCorrectionValue(radarCorrections, question.id, panel.id, axis.label);
            return applyRadarAxisCorrection(raw, correction, fixedScaleMax);
          };
          const correctedJurorValue = (juror: string, productCode: string, axis: RadarDisplayAxis): number => {
            const raw = getNote(juror, productCode, axis.id) ?? 0;
            if (!isCorrectionPanel) return raw;
            const correction = getCorrectionValue(radarCorrections, question.id, panel.id, axis.label);
            return applyRadarAxisCorrection(raw, correction, fixedScaleMax);
          };

          const radarData = {
            labels: panel.displayAxes.map(axis => axis.label),
            datasets: products.map((p, pi) => ({
              label: p.code,
              data: panel.displayAxes.map(axis => correctedPanelValue(p.code, axis)),
              borderColor: chartColors[pi % chartColors.length],
              backgroundColor: chartColors[pi % chartColors.length] + "22",
              pointBackgroundColor: chartColors[pi % chartColors.length],
              hidden: !isProductVisible(panelRadarKey, p.code),
            }))
          };

          const jurorRadarData = (participantMode && currentJuror) ? {
            labels: panel.displayAxes.map(axis => axis.label),
            datasets: products.map((p, pi) => ({
              label: p.code,
              data: panel.displayAxes.map(axis => correctedJurorValue(currentJuror, p.code, axis)),
              borderColor: chartColors[pi % chartColors.length],
              backgroundColor: chartColors[pi % chartColors.length] + "22",
              pointBackgroundColor: chartColors[pi % chartColors.length],
              hidden: !isProductVisible(jurorRadarKey, p.code),
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
          const panelValues = panel.displayAxes.flatMap(axis => products.map(p => correctedPanelValue(p.code, axis)));
          const radarMax = panel.fixedScale ? fixedScaleMax : computeMax(panelValues);
          const jurorValues = jurorRadarData
            ? panel.displayAxes.flatMap(axis => products.map(p => correctedJurorValue(currentJuror!, p.code, axis)))
            : [];
          const jurorMax = panel.fixedScale ? fixedScaleMax : computeMax(jurorValues);
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
                  ...(panel.fixedScale ? { startAngle: 0 } : {}),
                  ticks: {
                    showLabelBackdrop: false,
                    backdropColor: "transparent" as const,
                    stepSize,
                    precision: 0,
                  },
                },
              },
              plugins: {
                legend: { display: false },
              },
            };
          };

          return (
            <Fragment key={panel.id}>
              <Card title={participantMode ? `${panel.title} (Moyenne globale)` : panel.title}>
                {isCorrectionPanel ? (
                  <div className={radarChartWithCorrectionsClass}>
                    <div className={ANALYSIS_RADAR_WRAP}>
                      <Radar data={radarData} options={buildOpts(radarMax)} />
                    </div>
                    <RadarCorrectionControls
                      axes={panel.displayAxes}
                      questionId={question.id}
                      presetId={panel.id}
                      corrections={radarCorrections}
                      status={correctionSaveStatus}
                      onChange={onCorrectionChange}
                    />
                  </div>
                ) : (
                  <div className={ANALYSIS_RADAR_WRAP}>
                    <Radar data={radarData} options={buildOpts(radarMax)} />
                  </div>
                )}
                <ChartToggleLegend
                  items={legendItemsFor(panelRadarKey)}
                  ariaLabel="Légende des échantillons"
                  allAriaLabel="Afficher ou masquer tous les échantillons"
                  itemAriaLabel={(label) => `Afficher ou masquer l'échantillon ${label}`}
                  onToggle={(code, visible) => setProductVisible(panelRadarKey, code, visible)}
                  onToggleAll={(visible) => setAllProductsVisible(panelRadarKey, visible)}
                />
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
                        {panel.displayAxes.map(axis => (
                          <tr key={axis.id}>
                            <td
                              className={!panel.fixedScale && axis.id.includes(">") ? "font-normal text-[var(--mid)]" : "font-bold"}
                              style={{ paddingLeft: panel.fixedScale ? 0 : `${(axis.id.split(" > ").length - 1) * 12}px` }}
                            >
                              {axis.label}
                            </td>
                            {products.map(p => {
                              const m = correctedPanelValue(p.code, axis);
                              const s = sd(p.code, axis.id);
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
                <Card title={`${panel.title} (Vos réponses)`}>
                  <div className={ANALYSIS_RADAR_WRAP}>
                    <Radar data={jurorRadarData} options={buildOpts(jurorMax)} />
                  </div>
                  <ChartToggleLegend
                    items={legendItemsFor(jurorRadarKey)}
                    ariaLabel="Légende des échantillons"
                    allAriaLabel="Afficher ou masquer tous les échantillons"
                    itemAriaLabel={(label) => `Afficher ou masquer l'échantillon ${label}`}
                    onToggle={(code, visible) => setProductVisible(jurorRadarKey, code, visible)}
                    onToggleAll={(visible) => setAllProductsVisible(jurorRadarKey, visible)}
                  />
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
                  <td className={`${ANALYSIS_NUM_CELL} ${a.pApplicabilityFDR !== undefined && a.pApplicabilityFDR < 0.20 ? OK_TEXT + ' font-bold' : ''}`}>
                    {a.pApplicabilityFDR !== undefined ? (a.pApplicabilityFDR < 0.001 ? "< 0,001" : a.pApplicabilityFDR.toFixed(3)) : "—"}
                  </td>
                  <td className={`${ANALYSIS_NUM_CELL} ${a.pIntensityFDR !== undefined && a.pIntensityFDR < 0.20 ? OK_TEXT + ' font-bold' : ''}`}>
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
        <div className={grid2Class} style={radarPanelGridStyle(2)}>
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
                    hidden: !isProductVisible(pcaProductLegendKey, p.code),
                  }))
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  scales: {
                    x: { title: { display: true, text: `CP1 (${(pcaRes.explained[0]*100).toFixed(1)}%)` }, min: -scoreBound, max: scoreBound },
                    y: { title: { display: true, text: `CP2 (${((pcaRes.explained[1]||0)*100).toFixed(1)}%)` }, min: -scoreBound, max: scoreBound },
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx: TooltipItem<"scatter">) => {
                      const d = ctx.raw as { x: number; y: number; label: string };
                      return `${d.label}: (${d.x.toFixed(2)}, ${d.y.toFixed(2)})`;
                    } } }
                  }
                }}
              />
            </div>
            <ChartToggleLegend
              items={legendItemsFor(pcaProductLegendKey)}
              ariaLabel="Légende ACP des échantillons"
              allAriaLabel="Afficher ou masquer tous les échantillons ACP"
              itemAriaLabel={(label) => `Afficher ou masquer l'échantillon ACP ${label}`}
              onToggle={(code, visible) => setProductVisible(pcaProductLegendKey, code, visible)}
              onToggleAll={(visible) => setAllProductsVisible(pcaProductLegendKey, visible)}
            />
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
                        hidden: !isCriteriaVisible(pcaCriteriaLegendKey, c),
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
                    legend: { display: false },
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
            <ChartToggleLegend
              items={criteriaLegendItemsFor(pcaCriteriaLegendKey, pcaCriteria)}
              ariaLabel="Légende ACP des critères"
              allAriaLabel="Afficher ou masquer tous les critères ACP"
              itemAriaLabel={(label) => `Afficher ou masquer le critère ACP ${label}`}
              onToggle={(criteriaId, visible) => setCriteriaVisible(pcaCriteriaLegendKey, criteriaId, visible)}
              onToggleAll={(visible) => setAllCriteriaVisible(pcaCriteriaLegendKey, pcaCriteria, visible)}
            />
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
