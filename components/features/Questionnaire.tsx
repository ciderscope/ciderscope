"use client";

import { useEffect, useRef } from "react";
import { QuestionInput } from "./QuestionInput";
import { Question, Product } from "../../types";

interface QuestionnaireProps {
  steps: any[];
  currentStepIdx: number;
  ja: any;
  setJa: (newJa: any) => void;
  products?: Product[];
  jurorName?: string;
}

const stepKey = (step: any, idx: number) => {
  if (!step) return `s${idx}`;
  if (step.type === "product") return `product:${step.product.code}`;
  if (step.type === "ranking" || step.type === "discrim") return `${step.type}:${step.question.id}`;
  if (step.type === "global") return `global`;
  return `s${idx}`;
};

export const Questionnaire = ({ steps, currentStepIdx, ja, setJa, products, jurorName }: QuestionnaireProps) => {
  const step = steps[currentStepIdx];
  const startRef = useRef<number>(Date.now());
  const jaRef = useRef(ja);
  jaRef.current = ja;

  useEffect(() => {
    startRef.current = Date.now();
    const key = stepKey(step, currentStepIdx);
    return () => {
      const elapsed = Date.now() - startRef.current;
      if (elapsed < 200 || elapsed > 1000 * 60 * 30) return;
      const cur = jaRef.current || {};
      const prev = cur["_timing"]?.[key] || 0;
      setJa({ ...cur, _timing: { ...(cur["_timing"] || {}), [key]: prev + elapsed } });
    };

  }, [currentStepIdx]);

  if (!step) return null;

  const handleUpdate = (ctx: string, qid: string, val: any) => {
    const newJa = {
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
              key={q.id}
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
