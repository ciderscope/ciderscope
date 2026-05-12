"use client";
import React from "react";
import { Card } from "../../ui/Card";
import { AnalysisEmpty, ANALYSIS_TABLE_CLASS, answerStateClass } from "../../ui/AnalysisPrimitives";
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
  const trackedQuestions = qs.filter(q => ["classement","seuil","seuil-bet","triangulaire","duo-trio","a-non-a"].includes(q.type));
  const productStepByCode = new Map(
    allSteps
      .filter(step => step.type === "product")
      .map(step => [step.product.code, step])
  );
  const questionStepById = new Map(
    allSteps
      .filter(step => step.type === "ranking" || step.type === "discrim")
      .map(step => [step.question.id, step])
  );

  return (
    <Card title="Avancement par jury">
      <table className={ANALYSIS_TABLE_CLASS}>
        <thead>
          <tr>
            <th>Jury</th>
            {products.map(p => <th key={p.code}>{p.code}</th>)}
            {trackedQuestions.map(q => (
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
              <tr key={j} className={isSelf ? "[&_td]:bg-[color-mix(in_srgb,var(--accent)_14%,var(--paper))] [&_td:first-child]:border-l-[3px] [&_td:first-child]:border-l-[var(--accent)]" : ""}>
                <td className="font-semibold">{j}{isSelf && <span className="ml-1 text-[var(--accent)]" aria-label="vous">★</span>}</td>
                {products.map(p => {
                  const step = productStepByCode.get(p.code);
                  const answered = step ? checkStepDone(step, ja) : false;
                  return (
                    <td key={p.code} className={answerStateClass(answered)}>
                      {answered ? "✓" : "✗"}
                    </td>
                  );
                })}
                {trackedQuestions.map(q => {
                  const step = questionStepById.get(q.id);
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
