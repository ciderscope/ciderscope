"use client";
import React from "react";
import { FiArrowLeft, FiArrowRight, FiCheckCircle } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { Questionnaire } from "../../features/Questionnaire";
import { stepShortLabel } from "./utils";
import { SessionStep, SessionConfig, JurorAnswers } from "../../../types";

interface FormScreenProps {
  onHome: () => void;
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
}

export const FormScreen = ({
  onHome, steps, cs, completion, isStepComplete, onPrevStep, onNextStep,
  curSess, cj, ja, onSetJa, onValidateStep
}: FormScreenProps) => {
  const currentStep = steps[cs];
  const isLast = cs >= steps.length - 1;

  return (
    <div className="form-screen">
      <header className="form-header">
        <button className="back-btn" onClick={onHome}><FiArrowLeft /> Accueil</button>
        <div className="step-dots">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`dot ${i === cs ? "active" : ""} ${completion[i] ? "done" : ""}`}
              title={stepShortLabel(s)}
            />
          ))}
        </div>
        <div className="flex-1" />
        <div className="jury-badge">{cj}</div>
      </header>

      <div className="form-container">
        <Questionnaire
          key={cs}
          step={currentStep}
          config={curSess}
          answers={ja}
          onChange={onSetJa}
          onValidate={() => onValidateStep(cs)}
        />

        <div className="form-nav">
          <Button variant="ghost" onClick={onPrevStep} disabled={cs === 0}><FiArrowLeft /> Précédent</Button>
          <div className="flex-1" />
          <Button onClick={onNextStep} disabled={!isStepComplete(cs)}>
            {isLast ? "Terminer" : "Suivant"} <FiArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
};
