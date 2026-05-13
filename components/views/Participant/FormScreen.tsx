"use client";
import React, { useEffect, useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { Questionnaire } from "../../features/Questionnaire";
import { validateRadarAnswer } from "../../../lib/radarAnswer";
import { stepShortLabel } from "./utils";
import { ConfirmModal } from "./ConfirmModal";
import { SessionStep, SessionConfig, JurorAnswers, Question, RadarAxis, RadarAnswer, Product } from "../../../types";

type SetJa = (updater: JurorAnswers | ((prev: JurorAnswers) => JurorAnswers)) => void;

const getQuestionValue = (answers: JurorAnswers, ctx: string, questionId: string): unknown => {
  const section = answers[ctx];
  if (!section || typeof section !== "object" || Array.isArray(section)) return undefined;
  return (section as Record<string, unknown>)[questionId];
};

interface FormScreenProps {
  // "Changer" : retourne sur l'écran d'identification du jury sans repasser
  // par la liste des séances. Distinct de onGoBack/onHome qui ramènent au
  // landing.
  onChangeJury: () => void;
  steps: SessionStep[];
  cs: number;
  completion: boolean[];
  onPrevStep: () => void;
  onNextStep: () => void;
  curSess: SessionConfig;
  cj: string;
  ja: JurorAnswers;
  onSetJa: SetJa;
}

export const FormScreen = ({
  onChangeJury, steps, cs, completion, onPrevStep, onNextStep,
  curSess, cj, ja, onSetJa
}: FormScreenProps) => {
  const products: Product[] = curSess.products || [];
  const total = steps.length;
  let doneCount = 0;
  for (const c of completion) if (c) doneCount++;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const canAdvance = completion[cs] ?? true;
  const [confirmNext, setConfirmNext] = useState(false);
  const [confirmPrev, setConfirmPrev] = useState(false);
  const [radarIssues, setRadarIssues] = useState<{ untouched: string[]; emptyChildren: string[] } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const marker = { sensoParticipantFormLock: true };
    window.history.pushState(marker, "", window.location.href);
    const handlePopState = () => {
      setConfirmPrev(true);
      window.history.pushState(marker, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Pour l'étape courante : si elle contient une toile d'araignée, on calcule
  // les familles non touchées / non précisées avant de laisser passer.
  const currentStep = steps[cs];
  const radarValidation = (() => {
    if (!currentStep || currentStep.type !== "product") return null;
    const radarQ: Question | undefined = currentStep.questions.find(q => q.type === "radar");
    if (!radarQ || !radarQ.radarGroups) return null;
    const axes: RadarAxis[] = radarQ.radarGroups.flatMap(g => g.axes);
    const ans = getQuestionValue(ja, currentStep.product.code, radarQ.id) as RadarAnswer | undefined;
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
    setConfirmNext(false);
    onNextStep();
  };
  const handlePrevClick = () => {
    if (cs === 0) return;
    setConfirmPrev(true);
  };
  const handleConfirmPrev = () => {
    setConfirmPrev(false);
    onPrevStep();
  };

  return (
    <>
      <div className="form-shell mx-auto max-w-full overflow-x-clip px-3.5 pt-[18px] pb-[120px] supports-[not(overflow-x:clip)]:overflow-x-hidden min-[481px]:max-w-[min(94%,1280px)] min-[481px]:px-8 min-[481px]:pt-9 min-[481px]:pb-[120px] min-[721px]:pb-[110px]">
        <div className="mb-7 flex items-center gap-3.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)] px-[19px] py-[15px] shadow-[var(--shadow)]">
          <div>
            <div className="text-[17px] font-bold leading-[1.2]">{cj}</div>
            <div className="mt-0.5 font-mono text-[12.5px] text-[var(--mid)]">{curSess.name}</div>
          </div>
          <div className="flex-1"></div>
          <Button variant="ghost" size="sm" onClick={onChangeJury}><FiArrowLeft /> Changer</Button>
        </div>

        <div className="form-progress-wrap mt-1 mb-[18px] px-1 min-[481px]:mb-[26px] min-[481px]:px-4">
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
          <div className="step-list mt-2.5 flex gap-1 overflow-x-auto pb-1 min-[481px]:gap-1.5">
            {steps.map((s, i) => {
              const complete = completion[i] ?? false;
              const active = i === cs;


              return (
                <div
                  key={i}
                  title={`Étape ${i + 1}${complete ? " — complète" : ""}`}
                  className={[
                    "step-item flex-none rounded-full px-2.5 py-1 text-[11.5px] whitespace-nowrap",
                    active ? "bg-[var(--accent)] font-bold text-white" : complete ? "bg-[#1a6b3a22] font-semibold text-[#1a6b3a]" : "bg-[var(--paper2)] font-semibold text-[var(--mid)]",
                  ].join(" ")}
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
        />
      </div>
      
      <div className="product-nav fixed inset-x-0 bottom-0 z-50 flex items-center gap-[7px] border-t border-[var(--border)] bg-[var(--product-nav-bg)] px-2.5 py-[9px] backdrop-blur-[10px] min-[481px]:gap-2.5 min-[481px]:px-5 min-[481px]:py-[13px]">
        <div className="product-nav-info flex-1 text-[10px] text-[var(--mid)] min-[481px]:text-[12.5px]">
          {!canAdvance && (
            <span className="text-[11px] text-[#c0392b]">Répondez à la question pour continuer.</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrevClick}
          className={cs === 0 ? "invisible" : "visible"}
          aria-label="Étape précédente"
          title="Étape précédente"
        >
          <FiArrowLeft />
        </Button>
        <Button
          size="sm"
          onClick={handleNextClick}
          disabled={!canAdvance}
          className={!canAdvance ? "opacity-50 cursor-not-allowed" : ""}
          aria-label={cs >= total - 1 ? "Terminer le questionnaire" : "Étape suivante"}
          title={cs >= total - 1 ? "Terminer le questionnaire" : "Étape suivante"}
        >
          <FiArrowRight />
        </Button>
      </div>

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
          title="Revenir à l'étape précédente ?"
          message={<>Les réponses sont enregistrées. Ne revenez en arrière qu&apos;en cas d&apos;erreur manifeste.</>}
          confirmLabel="Revenir"
          cancelLabel="Annuler"
          confirmVariant="secondary"
          cancelVariant="primary"
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
