"use client";
import React, { useEffect, useMemo } from "react";
import { ScrollableTabs } from "../../ui/ScrollableTabs";
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
} from "chart.js";
import type { SessionConfig, SessionListItem, Question, AllAnswers, CSVRow } from "../../../types";
import { buildCsvData, buildDelimitedText, downloadTextFile } from "../../../lib/csv";

// Import subcomponents
import { AnalyseProfil } from "./AnalyseProfil";
import { AnalyseFriedman } from "./AnalyseFriedman";
import { AnalyseDiscrimType } from "./AnalyseDiscrimType";
import { AnalyseSeuilBET } from "./AnalyseSeuilBET";
import { AnalyseRadar } from "./AnalyseRadar";
import { AnalyseWordCloud } from "./AnalyseWordCloud";
import { AnalyseJury } from "./AnalyseJury";
import { AnalyseDonnees } from "./AnalyseDonnees";
import { useDarkMode, syncChartDefaults } from "./utils";

// Enregistrement Chart.js localisé : seul l'admin chargeant l'analyse paye le coût.
ChartJS.register(
  RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement
);

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
  allAnswers: AllAnswers;
  curAnT: string;
  onAnSessChange: (id: string) => void;
  onAnTabChange: (tab: string) => void;
  // Mode résumé participant : masque le sélecteur de séance, les exports CSV
  // et l'onglet "Données" (table brute). currentJuror permet de surligner les
  // lignes du jury dans les tableaux par-jury (highlightSelf=true).
  participantMode?: boolean;
  currentJuror?: string;
  downloadCSV?: (rows: CSVRow[], name: string) => void;
}

const downloadSensoMinerCSV = (data: CSVRow[], name: string) => {
  const quantData = data.filter(r => r.type === "scale" && r.produit !== "_global" && r.produit !== "_classement" && r.produit !== "_test");
  if (quantData.length === 0) {
    alert("Aucune donnée quantitative (échelle/radar) à exporter.");
    return;
  }
  
  const pivotMap = new Map<string, Record<string, string>>();
  const descriptors = new Set<string>();
  
  quantData.forEach(r => {
    const key = `${r.jury}__${r.produit}`;
    if (!pivotMap.has(key)) {
      pivotMap.set(key, { Juge: r.jury, Produit: r.produit });
    }
    pivotMap.get(key)![r.question] = String(r.valeur);
    descriptors.add(r.question);
  });
  
  const descArray = Array.from(descriptors).sort();
  const headers = ["Juge", "Produit", ...descArray];
  
  downloadTextFile(buildDelimitedText(headers, Array.from(pivotMap.values())), name + "_SensoMineR.csv");
};

export const AnalyseView = ({
  sessions, anSessId, anCfg, allAnswers, curAnT,
  onAnSessChange, onAnTabChange, downloadCSV,
  participantMode = false, currentJuror,
}: AnalyseViewProps) => {
  const csvData = useMemo(() => buildCsvData(anCfg, allAnswers), [anCfg, allAnswers]);

  // Theming Chart.js : on aligne les défauts (axes, grille) sur les variables
  // CSS qui basculent en mode sombre. useDarkMode déclenche un re-render au
  // changement de thème OS, ce qui propage la palette à tous les graphes.
  const isDark = useDarkMode();
  useEffect(() => {
    syncChartDefaults();
  }, [isDark]);

  // Rafraîchissement périodique des réponses côté admin : sans cela, les
  // finalisations / nouvelles réponses des jurys ne remontent pas (notamment
  // pour la coche globale dans l'onglet "Par jury"). On évite l'effet en mode
  // participant — le résumé est figé une fois ouvert.
  useEffect(() => {
    if (participantMode) return;
    if (!anSessId) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void onAnSessChange(anSessId);
    };
    const id = setInterval(tick, 5_000);
    return () => clearInterval(id);
  }, [participantMode, anSessId, onAnSessChange]);

  const tabs = useMemo(() => {
    const all = computeTabs(anCfg);
    // Vue participant : on retire l'onglet "Données" (table brute) — l'utilisateur
    // n'a pas vocation à voir / exporter le détail des autres jurys.
    return participantMode ? all.filter(t => t.id !== "données") : all;
  }, [anCfg, participantMode]);

  // Auto-select first valid tab when config changes
  const validIds = tabs.map(t => t.id);
  const activeTab = validIds.includes(curAnT) ? curAnT : (validIds[0] ?? "profil");

  return (
    <div
      className={`analyse-shell ${participantMode ? "analyse-shell--participant" : ""}`}
      data-current-juror={currentJuror || undefined}
    >
      {!participantMode && (
        <div className="flex items-center gap-3.5 mb-5 flex-wrap">
          <h2 className="font-extrabold text-[clamp(17px,2.5vw,22px)]">Analyse</h2>
          <div className="flex-1" />
          <label className="font-mono text-[11px] text-[var(--mid)]">Séance :</label>
          <select
            value={anSessId || ""}
            onChange={(e) => onAnSessChange(e.target.value)}
            className="border border-[var(--border)] rounded-md py-[5px] px-2 text-xs"
          >
            {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {anCfg && (
            <div className="flex gap-2">
              <button
                onClick={() => downloadCSV?.(csvData, anCfg.name)}
                title="Toutes les réponses (Format Long)"
                className="text-xs py-[5px] px-2.5 border border-[var(--border)] rounded-md cursor-pointer bg-[var(--paper)] text-[var(--ink)]"
              >
                ↓ CSV Standard
              </button>
              <button
                onClick={() => downloadSensoMinerCSV(csvData, anCfg.name)}
                title="Données quantitatives (Format Large Juge x Produit)"
                className="text-xs py-[5px] px-2.5 border border-[var(--border)] rounded-md cursor-pointer bg-[var(--paper)] text-[var(--ink)]"
              >
                ↓ CSV FactoMineR/R
              </button>
            </div>
          )}
        </div>
      )}

      {participantMode && anCfg && (
        <div className="mb-5">
          <h2 className="font-extrabold text-[clamp(17px,2.5vw,22px)]">Résumé de la séance</h2>
          <p className="text-[var(--mid)] text-[13px] mt-1">
            Vue d&apos;ensemble du panel — <strong className="text-[var(--accent)]">{currentJuror || "vous"}</strong> est mis en évidence dans les tableaux par jury.
          </p>
        </div>
      )}

      {!anCfg && (
        <div className="text-[var(--text-muted)] text-sm py-8">
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
            {activeTab === "radar"   && <AnalyseRadar     config={anCfg} allAnswers={allAnswers} participantMode={participantMode} currentJuror={currentJuror} />}
            {activeTab === "texte"   && <AnalyseWordCloud data={csvData} config={anCfg} />}
            {activeTab === "jury"    && <AnalyseJury      config={anCfg} allAnswers={allAnswers} currentJuror={currentJuror} />}
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
