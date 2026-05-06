"use client";
import React from "react";
import { Card } from "../../ui/Card";
import { AnalysisEmpty, AnalysisStack } from "../../ui/AnalysisPrimitives";
import type { SessionConfig, CSVRow } from "../../../types";

interface AnalyseProfilProps {
  config: SessionConfig;
  data: CSVRow[];
}

export function AnalyseProfil({ config, data }: AnalyseProfilProps) {
  // On ne garde que les questions définies comme "scale" dans la config
  // (les axes de la toile sont exclus : ils ont type="scale" dans le CSV mais proviennent de questions "radar").
  const scaleQuestions = (config.questions || []).filter(q => q.type === "scale");
  if (scaleQuestions.length === 0) {
    return <AnalysisEmpty>Aucune question d&apos;échelle dans cette séance.</AnalysisEmpty>;
  }

  const scaleLabels = new Set(scaleQuestions.map(q => q.label));
  const scaleData = data.filter(r =>
    r.type === "scale" && scaleLabels.has(r.question) && r.valeur !== "" && r.valeur != null
  );

  if (scaleData.length === 0) {
    return <AnalysisEmpty>Aucune réponse d&apos;échelle disponible.</AnalysisEmpty>;
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
    <AnalysisStack>
      {scaleQuestions.map(q => {
        const rows = scaleData.filter(r => r.question === q.label);
        if (rows.length === 0) {
          return (
            <Card key={q.id} title={q.label}>
              <div className="text-[var(--text-muted)] text-[13px]">Aucune réponse enregistrée.</div>
            </Card>
          );
        }

        if (q.scope === "per-product") {
          const products = [...new Set(rows.map(r => r.produit))];
          return (
            <Card key={q.id} title={q.label}>
              <div className="text-[11px] text-[var(--mid)] mb-2 font-mono">
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
                        <td className="num font-semibold">{fmt(s.mean)}</td>
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
            <div className="text-[11px] text-[var(--mid)] mb-2 font-mono">
              Moyenne sur l&apos;ensemble du questionnaire
            </div>
            <div className="flex gap-7 items-baseline flex-wrap">
              <div>
                <div className="text-[11px] text-[var(--mid)]">Moyenne</div>
                <div className="text-[28px] font-bold">{fmt(s.mean)}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--mid)]">Écart-type</div>
                <div className="text-lg">{s.sd == null ? "—" : `±${s.sd.toFixed(2)}`}</div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--mid)]">n réponses</div>
                <div className="text-lg">{s.n}</div>
              </div>
            </div>
          </Card>
        );
      })}
    </AnalysisStack>
  );
}
