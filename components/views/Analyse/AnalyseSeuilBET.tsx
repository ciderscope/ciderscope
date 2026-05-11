"use client";
import React from "react";
import { Card } from "../../ui/Card";
import {
  AnalysisEmpty,
  AnalysisStack,
  MetricLayout,
  MetricBlock,
  TableCaption,
  DetailTable,
  OK_TEXT,
  DANGER_TEXT,
  DIM_TEXT
} from "../../ui/AnalysisPrimitives";
import type { SessionConfig, AllAnswers, Question, BetLevel } from "../../../types";

interface AnalyseSeuilBETProps {
  config: SessionConfig;
  allAnswers: AllAnswers;
  questionId: string;
}

const getDiscrimAnswers = (allAnswers: AllAnswers, juror: string, questionId: string): Record<string, string> => {
  const discrim = allAnswers[juror]?._discrim;
  if (!discrim || typeof discrim !== "object" || Array.isArray(discrim)) return {};
  const answers = (discrim as Record<string, unknown>)[questionId];
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return {};
  return answers as Record<string, string>;
};

export function AnalyseSeuilBET({ config, allAnswers, questionId }: AnalyseSeuilBETProps) {
  const questions: Question[] = (config?.questions || []).filter((q: Question) => q.type === "seuil-bet" && q.id === questionId);
  const jurors = Object.keys(allAnswers || {});

  if (questions.length === 0 || jurors.length === 0) {
    return <AnalysisEmpty>Aucune donnée disponible.</AnalysisEmpty>;
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
    <AnalysisStack>
      {questions.map((q: Question) => {
        const levels: BetLevel[] = q.betLevels || [];
        if (levels.length === 0) {
          return (
            <Card key={q.id} title={`Seuil 3-AFC — ${q.label}`}>
              <div className="text-[var(--text-muted)]">Aucun niveau défini.</div>
            </Card>
          );
        }

        const perJury = jurors.map(j => {
          const answers = getDiscrimAnswers(allAnswers, j, q.id);
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
            <MetricLayout>
              <MetricBlock
                minClass="min-w-40"
                value={groupBET != null ? groupBET.toPrecision(3) : "—"}
                label="seuil de groupe (BET)"
                note={<>moyenne géométrique sur {valid.length} / {perJury.length} jurys</>}
                valueClassName={`text-[clamp(30px,4vw,44px)] font-extrabold ${OK_TEXT}`}
              />

              <div className="min-w-[260px] flex-1">
                <TableCaption>Réponses correctes par niveau</TableCaption>
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
            </MetricLayout>

            <DetailTable
              summary="Détail par jury (ASTM E679)"
              note={<>BET = moyenne géométrique des concentrations encadrant la dernière inversion (ASTM E679). (≤) : toutes réponses correctes, seuil censuré sous la plus faible concentration. (≥) : aucune réponse correcte, seuil censuré au-dessus de la plus forte concentration.</>}
            >
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
                        <td key={i} className={`num font-semibold ${t === "+" ? OK_TEXT : t === "-" ? DANGER_TEXT : DIM_TEXT}`}>
                          {t === "+" ? "✓" : t === "-" ? "✗" : "—"}
                        </td>
                      ))}
                      <td className="num">
                        {r.bet != null ? r.bet.toPrecision(3) : "—"}
                        {r.censored === "low" && <span className="text-[10px] text-[var(--mid)]"> (≤)</span>}
                        {r.censored === "high" && <span className="text-[10px] text-[var(--mid)]"> (≥)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
            </DetailTable>
          </Card>
        );
      })}
    </AnalysisStack>
  );
}
