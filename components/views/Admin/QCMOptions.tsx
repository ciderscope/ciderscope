"use client";
import React from "react";
import { FiX, FiPlus, FiCheck } from "react-icons/fi";
import { Button } from "../../ui/Button";

interface QCMOptionsProps {
  options: string[];
  correctAnswer?: string;
  onChange: (o: string[]) => void;
  onChangeCorrect: (v: string) => void;
}

export function QCMOptions({ options, correctAnswer, onChange, onChangeCorrect }: QCMOptionsProps) {
  return (
    <div className="qcm-options-builder">
      <div className="text-[11px] text-[var(--mid)] mb-2">
        Cliquez sur <FiCheck size={11} className="align-middle" /> pour marquer la bonne réponse (utilisée en analyse pour calculer le score)
      </div>
      {options.map((opt, i) => (
        <div key={i} className="qcm-option-row">
          <button
            type="button"
            className={`qcm-correct-btn${correctAnswer === opt ? " active" : ""}`}
            title={correctAnswer === opt ? "Bonne réponse (cliquer pour désélectionner)" : "Marquer comme bonne réponse"}
            onClick={() => onChangeCorrect(correctAnswer === opt ? "" : opt)}
          >
            <FiCheck size={12} />
          </button>
          <input
            value={opt}
            onChange={(e) => { const n = [...options]; n[i] = e.target.value; onChange(n); }}
            placeholder={`Option ${i + 1}`}
          />
          <button className="chip-x" onClick={() => {
            onChange(options.filter((_, idx) => idx !== i));
            if (correctAnswer === opt) onChangeCorrect("");
          }} type="button">
            <FiX />
          </button>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange([...options, ""])} className="mt-1.5">
        <FiPlus /> Ajouter une option
      </Button>
    </div>
  );
}
