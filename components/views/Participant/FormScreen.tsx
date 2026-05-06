"use client";
import React, { useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { Questionnaire } from "../../features/Questionnaire";
import { validateRadarAnswer } from "../../features/QuestionInput";
import { stepShortLabel } from "./utils";
import { SaveIndicator } from "./utils";
import { ConfirmModal } from "./ConfirmModal";
import { SessionStep, SessionConfig, JurorAnswers, SaveStatus, Question, RadarAxis, RadarAnswer, Product } from "../../../types";

interface FormScreenProps {
  onHome: () => void;
  onGoBack: () => void;
  steps: SessionStep[];
  cs: number;
  completion: boolean[];
  isStepComplete: (idx: number) => boolean;
  onPrevStep: () => void;
  onNextStep: () => void;
  curSess: SessionConfig;
  cj: string;
  ja: JurorAnswers;
  onSetJa: (ja: JurorAnswers) => void;
  onValidateStep: (idx: number) => void;
  saveStatus: SaveStatus;
  pendingCount: number;
  validatedSteps: Set<number>;
}

export const FormScreen = ({
  onGoBack, steps, cs, completion, onPrevStep, onNextStep,
  curSess, cj, ja, onSetJa, onValidateStep, saveStatus, pendingCount, validatedSteps
}: FormScreenProps) => {
  const products: Product[] = curSess.products || [];
  const total = steps.length;
  let doneCount = 0;
  for (const c of completion) if (c) doneCount++;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const canAdvance = completion[cs] ?? true;
  const prevAlreadyValidated = cs > 0 && validatedSteps.has(cs - 1);

  const [confirmNext, setConfirmNext] = useState(false);
  const [confirmPrev, setConfirmPrev] = useState(false);
  const [radarIssues, setRadarIssues] = useState<{ untouched: string[]; emptyChildren: string[] } | null>(null);

  // Pour l'étape courante : si elle contient une toile d'araignée, on calcule
  // les familles non touchées / non précisées avant de laisser passer.
  const currentStep = steps[cs];
  const radarValidation = (() => {
    if (!currentStep || currentStep.type !== "product") return null;
    const radarQ: Question | undefined = currentStep.questions.find(q => q.type === "radar");
    if (!radarQ || !radarQ.radarGroups) return null;
    const axes: RadarAxis[] = radarQ.radarGroups.flatMap(g => g.axes);
    const ans = (ja[currentStep.product.code]?.[radarQ.id]) as RadarAnswer | undefined;
    const min = radarQ.min ?? 0;
    return { axes, ans: ans || {}, min };
  })();

  const handleNextClick = () => {
    if (!canAdvance) return;
    if (radarValidation) {
      const issues = validateRadarAnswer(radarValidation.ans, radarValidation.axes, radarValidation.min);
      if (issues.untouched.length > 0 || issues.emptyChildren.length > 0) {
        setRadarIssues(issues);
        return;
      }
    }
    setConfirmNext(true);
  };
  const handleConfirmNext = () => {
    onValidateStep(cs);
    setConfirmNext(false);
    onNextStep();
  };
  const handlePrevClick = () => {
    if (cs === 0) return;
    if (prevAlreadyValidated) {
      setConfirmPrev(true);
    } else {
      onPrevStep();
    }
  };
  const handleConfirmPrev = () => {
    setConfirmPrev(false);
    onPrevStep();
  };

  return (
    <>
      <div className="form-shell">
        <div className="form-header">
          <div>
            <div className="jury-name">{cj}</div>
            <div className="session-name">{curSess.name}</div>
          </div>
          <div className="form-header-sep"></div>
          <Button variant="ghost" size="sm" onClick={onGoBack}><FiArrowLeft /> Changer</Button>
        </div>

        <div className="form-progress-wrap px-4 mt-1">
          <div className="flex justify-between text-[12.5px] text-[var(--mid)] mb-1.5">
            <span><strong className="text-[var(--ink)] font-bold">Étape {cs + 1}</strong> / {total}</span>
            <span>{doneCount} / {total} complétées · {pct}%</span>
          </div>
          <div className="h-2 bg-[var(--paper2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-[width] duration-200 ease-in-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="step-list flex gap-1.5 mt-2.5 overflow-x-auto pb-1">
            {steps.map((s, i) => {
              const complete = completion[i] ?? false;
              const active = i === cs;
              const bg = active ? "var(--accent)" : complete ? "#1a6b3a22" : "var(--paper2)";
              const col = active ? "#fff" : complete ? "#1a6b3a" : "var(--mid)";
              return (
                <div
                  key={i}
                  title={`Étape ${i + 1}${complete ? " — complète" : ""}`}
                  className={`step-item flex-none px-2.5 py-1 rounded-full text-[11.5px] whitespace-nowrap ${active ? "active font-bold" : "font-semibold"} ${complete ? "complete" : ""}`}
                  style={{ background: bg, color: col }}
                >
                  {stepShortLabel(s)}{complete && !active ? " ✓" : ""}
                </div>
              );
            })}
          </div>
        </div>

        <Questionnaire
          steps={steps}
          currentStepIdx={cs}
          ja={ja}
          setJa={onSetJa}
          products={products}
          jurorName={cj}
        />
      </div>
      
      <div className="product-nav">
        <div className="product-nav-info">
          {!canAdvance && (
            <span className="text-[11px] text-[#c0392b]">Répondez à la question pour continuer.</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handlePrevClick} className={cs === 0 ? "invisible" : "visible"}>
          <FiArrowLeft />
        </Button>
        <Button
          size="sm"
          onClick={handleNextClick}
          disabled={!canAdvance}
          className={!canAdvance ? "opacity-50 cursor-not-allowed" : ""}
        >
          <FiArrowRight />
        </Button>
      </div>

      <SaveIndicator status={saveStatus} pendingCount={pendingCount} />

      {confirmNext && (
        <ConfirmModal
          title="Valider l'étape ?"
          message="Voulez-vous passer à l'étape suivante ? Les données seront enregistrées."
          confirmLabel="Suivant"
          cancelLabel="Annuler"
          onConfirm={handleConfirmNext}
          onCancel={() => setConfirmNext(false)}
        />
      )}
      {confirmPrev && (
        <ConfirmModal
          title="Modifier l'étape précédente ?"
          message={<>L&apos;étape précédente a déjà été validée. Y retourner pourrait modifier vos réponses.</>}
          confirmLabel="Modifier"
          cancelLabel="Annuler"
          tone="warn"
          onConfirm={handleConfirmPrev}
          onCancel={() => setConfirmPrev(false)}
        />
      )}
      {radarIssues && (
        <ConfirmModal
          title="Attention : réponses incomplètes"
          message={
            <div className="flex flex-col gap-2.5">
              <p>Certains critères de la toile d&apos;araignée n&apos;ont pas été évalués.</p>
              {radarIssues.untouched.length > 0 && (
                <div>
                  <strong>Curseurs jamais validés :</strong>
                  <ul className="mt-1 ml-4 list-disc text-[13px]">
                    {radarIssues.untouched.map(f => <li key={f}><em>{f}</em></li>)}
                  </ul>
                  <p className="text-[12px] text-[var(--mid)] mt-1">
                    Touchez le pouce de chaque curseur (au moins une fois) pour confirmer votre évaluation, y compris si l&apos;intensité est nulle.
                  </p>
                </div>
              )}
              {radarIssues.emptyChildren.length > 0 && (
                <div>
                  <strong>Familles évaluées sans aucun descripteur précisé :</strong>
                  <ul className="mt-1 ml-4 list-disc text-[13px]">
                    {radarIssues.emptyChildren.map(f => <li key={f}><em>{f}</em></li>)}
                  </ul>
                  <p className="text-[12px] text-[var(--mid)] mt-1">
                    Si une famille a une intensité &gt; 0, dépliez-la (bouton +) et notez au moins un de ses descripteurs.
                  </p>
                </div>
              )}
            </div>
          }
          confirmLabel="Compris, je corrige"
          tone="warn"
          onConfirm={() => setRadarIssues(null)}
          onCancel={() => setRadarIssues(null)}
        />
      )}
    </>
  );
};