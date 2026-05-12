"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { QuestionInput } from "./QuestionInput";
import { Question, Product, SessionStep, JurorAnswers, AnswerValue } from "../../types";

// `setJa` accepte un objet complet OU un updater fonctionnel (comme
// `useState`). L'updater garantit qu'on lit l'état le plus récent au moment
// où il s'exécute — indispensable pour le cleanup de `_timing` qui tourne
// pendant le démontage et qui sinon écraserait des écritures concurrentes
// (ex. `_finished: true` posé par "Terminer" juste avant `setScreen("done")`).
type SetJa = (updater: JurorAnswers | ((prev: JurorAnswers) => JurorAnswers)) => void;

interface QuestionnaireProps {
  steps: SessionStep[];
  currentStepIdx: number;
  ja: JurorAnswers;
  setJa: SetJa;
  products?: Product[];
}

const stepKey = (step: SessionStep | undefined, idx: number) => {
  if (!step) return `s${idx}`;
  if (step.type === "product") return `product:${step.product.code}`;
  if (step.type === "ranking" || step.type === "discrim") return `${step.type}:${step.question.id}`;
  if (step.type === "global") return `global`;
  return `s${idx}`;
};

const productLabelClass = "mb-[22px] inline-flex items-center gap-1.5 rounded-md bg-[var(--ink)] px-4 py-[7px] font-mono text-[13px] font-bold uppercase leading-tight tracking-[1.6px] text-white dark:bg-[var(--paper3)] dark:text-[var(--accent)]";

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
      // Updater fonctionnel : `prev` correspond à la version courante de `ja`
      // au moment où le cleanup s'exécute, ce qui préserve les écritures
      // concurrentes faites juste avant `setScreen(...)` (notamment
      // `_finished: true` lors de "Terminer").
      setJa((prev) => {
        const timing = (prev["_timing"] || {}) as Record<string, number>;
        const last = timing[key] || 0;
        return { ...prev, _timing: { ...timing, [key]: last + elapsed } } as JurorAnswers;
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIdx]);

  // Setter stable : lit `ja` depuis la ref pour ne pas être ré-instancié à
  // chaque saisie. Permet aux QuestionInput memoïsés en aval de ne pas se
  // re-rendre quand seul `ja` change pour un autre champ que le leur.
  const handleUpdate = useCallback((ctx: string, qid: string, val: AnswerValue) => {
    setJa((prev) => {
      const current = prev[ctx];
      const bucket = current && typeof current === "object" && !Array.isArray(current)
        ? current as Record<string, AnswerValue>
        : {};
      return { ...prev, [ctx]: { ...bucket, [qid]: val } };
    });
  }, [setJa]);

  // Cache un `onChange(val)` stable par couple (ctx, qid) — sinon l'arrow
  // créée à chaque render casserait React.memo sur QuestionInput.
  // L'instance est jetée quand `handleUpdate` change (rare).
  const onChangeMap = useMemo(() => new Map<string, (val: AnswerValue) => void>(), []);
  const getOnChange = useCallback((ctx: string, qid: string) => {
    const k = `${ctx}|${qid}`;
    let cb = onChangeMap.get(k);
    if (!cb) {
      cb = (val: AnswerValue) => handleUpdate(ctx, qid, val);
      onChangeMap.set(k, cb);
    }
    return cb;
  }, [handleUpdate, onChangeMap]);

  const getAnswerValue = (ctx: string, qid: string): AnswerValue => {
    const current = ja[ctx];
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, AnswerValue>)[qid];
  };

  if (!step) return null;

  return (
    <div className="product-card mb-4 min-w-0 max-w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)] px-3.5 py-4 shadow-[var(--shadow)] animate-[slideUp_.22s_ease] min-[481px]:p-[22px]">
      {step.type === "product" && (
        <>
          <div className={productLabelClass}>ÉCHANTILLON {step.product.code}</div>
          {step.questions.map((q: Question) => (
            <QuestionInput
              key={`${step.product.code}:${q.id}`}
              q={q}
              value={getAnswerValue(step.product.code, q.id)}
              onChange={getOnChange(step.product.code, q.id)}
              products={products}
            />
          ))}
        </>
      )}
      {step.type === "ranking" && (
        <>
          <div className={productLabelClass}>{step.question.type === "seuil" ? "SEUIL DE PERCEPTION" : "CLASSEMENT"}</div>
          <QuestionInput
            q={step.question}
            value={getAnswerValue("_rank", step.question.id)}
            onChange={getOnChange("_rank", step.question.id)}
            products={products}
          />
        </>
      )}
      {step.type === "discrim" && (
        <>
          <div className={productLabelClass}>TEST DISCRIMINATIF</div>
          <QuestionInput
            q={step.question}
            value={getAnswerValue("_discrim", step.question.id)}
            onChange={getOnChange("_discrim", step.question.id)}
            products={products}
          />
        </>
      )}
      {step.type === "global" && (
        <>
          <div className={productLabelClass}>QUESTIONS GÉNÉRALES</div>
          {step.questions.map((q: Question) => (
            <QuestionInput
              key={q.id}
              q={q}
              value={getAnswerValue("_global", q.id)}
              onChange={getOnChange("_global", q.id)}
              products={products}
            />
          ))}
        </>
      )}
    </div>
  );
};
