"use client";
import React, { useMemo } from "react";
import { Card } from "../../ui/Card";
import type { AllAnswers, AnswerValue, RadarAnswer, SessionConfig } from "../../../types";
import { asRecord } from "../../../lib/sessionSteps";
import { flattenRadarAnswers } from "./utils";

type CriterionBucket = { label: string; values: number[]; hasStrongNote: boolean };

const readNumber = (value: unknown): number | null => (
  typeof value === "number" && Number.isFinite(value) ? value : null
);

const pushValue = (bucket: Map<string, CriterionBucket>, label: string, value: unknown) => {
  const parts = label.split(" > ").map(part => part.trim());
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) return;

  const n = readNumber(value);
  if (n === null) return;
  const current = bucket.get(label) ?? { label, values: [], hasStrongNote: false };
  current.values.push(n);
  if (n > 5) current.hasStrongNote = true;
  bucket.set(label, current);
};

export function AnalyseSynthese({ config, allAnswers }: { config: SessionConfig; allAnswers: AllAnswers }) {
  const products = useMemo(() => config.products || [], [config.products]);
  const summaries = useMemo(() => products.map(product => {
    const buckets = new Map<string, CriterionBucket>();

    Object.values(allAnswers).forEach(answers => {
      const productAnswers = asRecord(answers[product.code]);
      (config.questions || []).forEach(question => {
        if (question.scope !== "per-product") return;
        if (question.codes?.length && !question.codes.includes(product.code)) return;

        const raw = productAnswers[question.id] as AnswerValue;
        if (question.type === "scale") {
          pushValue(buckets, question.label, typeof raw === "object" && raw !== null && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)._
            : raw);
          if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
            const scale = raw as Record<string, unknown>;
            const subs = Array.isArray(scale._subs) ? scale._subs.filter((x): x is string => typeof x === "string") : [];
            subs.forEach(sub => pushValue(buckets, `${question.label} > ${sub}`, scale[sub]));
          }
          return;
        }

        if (question.type === "radar" && raw && typeof raw === "object" && !Array.isArray(raw)) {
          const flat = flattenRadarAnswers(raw as RadarAnswer);
          Object.entries(flat).forEach(([label, value]) => pushValue(buckets, label, value));
        }
      });
    });

    const criteria = Array.from(buckets.values())
      .filter(item => item.hasStrongNote && item.values.length > 0)
      .map(item => ({
        label: item.label,
        mean: item.values.reduce((sum, value) => sum + value, 0) / item.values.length,
      }))
      .sort((a, b) => b.mean - a.mean)
      .slice(0, 5);

    return { product, criteria };
  }), [allAnswers, config.questions, products]);

  if (products.length === 0) return null;

  return (
    <Card title="Synthèse" className="mb-5">
      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {summaries.map(({ product, criteria }) => (
          <div key={product.code} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--paper2)] p-3.5">
            <div className="mb-2 flex items-baseline gap-2">
              <h4 className="m-0 text-sm font-bold text-[var(--ink)]">{product.code}</h4>
              {product.label && <span className="min-w-0 truncate text-xs text-[var(--mid)]">{product.label}</span>}
            </div>
            {criteria.length > 0 ? (
              <ol className="flex flex-col gap-1.5">
                {criteria.map(item => (
                  <li key={item.label} className="flex min-w-0 items-baseline justify-between gap-3 rounded-md bg-[var(--paper)] px-2.5 py-1.5 text-xs">
                    <span className="min-w-0 break-words font-medium text-[var(--ink)]">{item.label}</span>
                    <span className="shrink-0 font-mono font-semibold text-[var(--accent)]">{item.mean.toFixed(1)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-xs text-[var(--text-muted)]">Aucun critère au-dessus de 5/10.</div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
