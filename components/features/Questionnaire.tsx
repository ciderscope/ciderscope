"use client";

import { useEffect, useRef } from "react";
import { QuestionInput } from "./QuestionInput";
import { Question, Product, SessionStep, JurorAnswers, AnswerValue } from "../../types";

interface QuestionnaireProps {
  steps: SessionStep[];
  currentStepIdx: number;
  ja: JurorAnswers;
  setJa: (newJa: JurorAnswers) => void;
  products?: Product[];
  jurorName?: string;
}

const stepKey = (step: SessionStep | undefined, idx: number) => {
  if (!step) return `s${idx}`;
  if (step.type === "product") return `product:${step.product.code}`;
  if (step.type === "ranking" || step.type === "discrim") return `${step.type}:${step.question.id}`;
  if (step.type === "global") return `global`;
  return `s${idx}`;
};

export const Questionnaire = ({ steps, currentStepIdx, ja, setJa, products }: QuestionnaireProps) => {
  const step = steps[currentStepIdx];
  const startRef = useRef<number | null>(null);
  const jaRef = useRef(ja);
  useEffect(() => {
    jaRef.current = ja;
  }, [ja]);

  useEffect(() => {
    startRef.current = Date.now();
    const key = stepKey(step, currentStepIdx);
    return () => {
      if (startRef.current === null) return;
      const elapsed = Date.now() - startRef.current;
      if (elapsed < 200 || elapsed > 1000 * 60 * 30) return;
      const cur = jaRef.current || {};
      const timing = (cur["_timing"] || {}) as Record<string, number>;
      const prev = timing[key] || 0;
      setJa({ ...cur, _timing: { ...timing, [key]: prev + elapsed } } as JurorAnswers);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIdx]);

  if (!step) return null;

  const handleUpdate = (ctx: string, qid: string, val: AnswerValue) => {
    const newJa: JurorAnswers = {
      ...ja,
      [ctx]: { ...(ja[ctx] || {}), [qid]: val },
    };
    setJa(newJa);
  };

  return (
    <div className="product-card">
      {step.type === "product" && (
        <>
          <div className="product-label">ÉCHANTILLON {step.product.code}</div>
          {step.questions.map((q: Question) => (
            <QuestionInput
              key={`${step.product.code}:${q.id}`}
              q={q}
              value={ja[step.product.code]?.[q.id]}
              onChange={(val) => handleUpdate(step.product.code, q.id, val)}
              products={products}
            />
          ))}
        </>
      )}
      {step.type === "ranking" && (
        <>
          <div className="product-label">{step.question.type === "seuil" ? "SEUIL DE PERCEPTION" : "CLASSEMENT"}</div>
          <QuestionInput
            q={step.question}
            value={ja["_rank"]?.[step.question.id]}
            onChange={(val) => handleUpdate("_rank", step.question.id, val)}
            products={products}
          />
        </>
      )}
      {step.type === "discrim" && (
        <>
          <div className="product-label">TEST DISCRIMINATIF</div>
          <QuestionInput
            q={step.question}
            value={ja["_discrim"]?.[step.question.id]}
            onChange={(val) => handleUpdate("_discrim", step.question.id, val)}
            products={products}
          />
        </>
      )}
      {step.type === "global" && (
        <>
          <div className="product-label">QUESTIONS GÉNÉRALES</div>
          {step.questions.map((q: Question) => (
            <QuestionInput
              key={q.id}
              q={q}
              value={ja["_global"]?.[q.id]}
              onChange={(val) => handleUpdate("_global", q.id, val)}
              products={products}
            />
          ))}
        </>
      )}
    </div>
  );
};
