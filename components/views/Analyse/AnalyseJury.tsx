"use client";
import React from "react";
import { Card } from "../../ui/Card";
import { AnalysisEmpty, answerStateClass } from "../../ui/AnalysisPrimitives";
import type { SessionConfig, AllAnswers, Question, Product } from "../../../types";
import { checkStepDone, getSteps } from "./utils";

interface AnalyseJuryProps {
  config: SessionConfig;
  allAnswers: AllAnswers;
  currentJuror?: string;
}

export function AnalyseJury({ config, allAnswers, currentJuror }: AnalyseJuryProps) {
  const jurors = Object.keys(allAnswers || {});
  if (jurors.length === 0) {
    return <AnalysisEmpty>Aucun jury enregistré.</AnalysisEmpty>;
  }

  const qs: Question[] = config.questions || [];
  const products: Product[] = config.products || [];
  const allSteps = getSteps(config);

  return (
    <Card title="Avancement par jury">
      <table className="data-table">
        <thead>
          <tr>
            <th>Jury</th>
            {products.map(p => <th key={p.code}>{p.code}</th>)}
            {qs.filter(q => ["classement","seuil","seuil-bet","triangulaire","duo-trio","a-non-a"].includes(q.type)).map(q => (
              <th key={q.id} className="max-w-20 overflow-hidden text-ellipsis" title={q.label}>
                {q.label.length > 12 ? q.label.slice(0, 10) + "…" : q.label}
              </th>
            ))}
            <th>Global</th>
          </tr>
        </thead>
        <tbody>
          {jurors.map(j => {
            const ja = allAnswers[j] || {};
            const done = ja["_finished"] === true;

            const isSelf = !!currentJuror && j === currentJuror;
            return (
              <tr key={j} className={isSelf ? "self" : ""}>
                <td className="font-semibold">{j}{isSelf && <span className="ml-1 text-[var(--accent)]" aria-label="vous">★</span>}</td>
                {products.map(p => {
                  const step = allSteps.find(s => s.type === "product" && s.product.code === p.code);
                  const answered = step ? checkStepDone(step, ja) : false;
                  return (
                    <td key={p.code} className={answerStateClass(answered)}>
                      {answered ? "✓" : "✗"}
                    </td>
                  );
                })}
                {qs.filter(q => ["classement","seuil","seuil-bet","triangulaire","duo-trio","a-non-a"].includes(q.type)).map(q => {
                  const step = allSteps.find(s =>
                    (s.type === "ranking" || s.type === "discrim") && s.question.id === q.id
                  );
                  const answered = step ? checkStepDone(step, ja) : false;
                  return (
                    <td key={q.id} className={answerStateClass(answered)}>
                      {answered ? "✓" : "✗"}
                    </td>
                  );
                })}
                <td className={answerStateClass(done)}>
                  {done ? "✓" : "✗"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
