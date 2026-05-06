"use client";
import React, { useMemo } from "react";
import { Card } from "../../ui/Card";
import { AnalysisEmpty, AnalysisStack, DetailTable } from "../../ui/AnalysisPrimitives";
import type { SessionConfig, CSVRow, Question, Product } from "../../../types";
import { wordColor } from "./utils";

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
      <div className="mb-3 text-xs text-[var(--text-muted)]">
        {rows.length} réponse{rows.length > 1 ? "s" : ""} · {sorted.length} mots distincts
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 p-4 leading-[1.4]">
        {sorted.map(([word, freq]) => (
          <span
            key={word}
            title={`${freq} occurrence${freq > 1 ? "s" : ""}`}
            className="cursor-default transition-opacity"
            style={{
              fontSize: `${Math.round(11 + (freq / maxFreq) * 28)}px`,
              fontWeight: freq >= maxFreq * 0.6 ? 700 : freq >= maxFreq * 0.3 ? 600 : 400,
              color: wordColor(word),
              opacity: 0.55 + (freq / maxFreq) * 0.45,
            }}
          >
            {word}
          </span>
        ))}
      </div>
      <DetailTable summary="Tableau des fréquences">
          <thead><tr><th>Mot</th><th>Occurrences</th></tr></thead>
          <tbody>
            {sorted.slice(0, 20).map(([w, f]) => <tr key={w}><td>{w}</td><td className="num">{f}</td></tr>)}
          </tbody>
      </DetailTable>
    </Card>
  );
}

interface AnalyseWordCloudProps {
  data: CSVRow[];
  config: SessionConfig;
}

export function AnalyseWordCloud({ data, config }: AnalyseWordCloudProps) {
  const textRows = data.filter(r => r.type === "text" && r.valeur && r.valeur.trim());
  const questionLabels = [...new Set(textRows.map(r => r.question))] as string[];

  if (textRows.length === 0) {
    return <AnalysisEmpty>Aucune réponse textuelle disponible.</AnalysisEmpty>;
  }

  const qs: Question[] = config?.questions || [];
  const products: Product[] = config?.products || [];

  return (
    <AnalysisStack>
      {questionLabels.map(qLabel => {
        const qConfig = qs.find((qq: Question) => qq.label === qLabel);
        const isPerProduct = qConfig?.scope === "per-product" && products.length > 0;
        const qRows = textRows.filter(r => r.question === qLabel);

        if (isPerProduct) {
          return (
            <div key={qLabel}>
              <div className="builder-section-label !mb-3.5">{qLabel}</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
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
    </AnalysisStack>
  );
}
