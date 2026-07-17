"use client";
import React from "react";
import { FiX, FiPlus, FiCheck } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { chipRemoveButtonClass } from "./utils";

interface QCMOptionsProps {
  options: string[];
  correctAnswer?: string;
  onChange: (o: string[]) => void;
  onChangeCorrect: (v: string) => void;
}

export function QCMOptions({ options, correctAnswer, onChange, onChangeCorrect }: QCMOptionsProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="text-[11px] text-[var(--mid)] mb-2">
        Cliquez sur <FiCheck size={11} className="align-middle" /> pour marquer la bonne réponse (utilisée en analyse pour calculer le score)
      </div>
      {options.map((opt, i) => (
        <div key={i} className="flex min-h-11 items-center gap-[7px] rounded-[7px] border border-[var(--border)] bg-[var(--paper)] p-1.5">
          <button
            type="button"
            className={[
              "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border bg-transparent text-[var(--mid)] transition-all duration-100 hover:border-[var(--ok)] hover:text-[var(--ok)]",
              correctAnswer === opt ? "border-[var(--ok)] bg-[var(--ok)] text-white hover:text-white" : "border-[var(--border)]",
            ].join(" ")}
            title={correctAnswer === opt ? "Bonne réponse (cliquer pour désélectionner)" : "Marquer comme bonne réponse"}
            onClick={() => onChangeCorrect(correctAnswer === opt ? "" : opt)}
          >
            <FiCheck size={12} />
          </button>
          <input
            className="flex-1 bg-transparent px-1 py-[7px] text-[13px] font-[inherit] outline-none"
            value={opt}
            onChange={(e) => { const n = [...options]; n[i] = e.target.value; onChange(n); }}
            placeholder={`Option ${i + 1}`}
          />
          <button className={chipRemoveButtonClass} onClick={() => {
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
