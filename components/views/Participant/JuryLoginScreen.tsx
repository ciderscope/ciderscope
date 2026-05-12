"use client";
import React, { useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { SessionConfig } from "../../../types";

interface JuryLoginScreenProps {
  curSess: SessionConfig | null;
  jurors: string[];
  onLoginJury: (name: string) => void;
  onHome: () => void;
  onGoBack: () => void;
}

export const JuryLoginScreen = ({ curSess, jurors, onLoginJury, onHome, onGoBack }: JuryLoginScreenProps) => {
  const [name, setName] = useState("");
  const submit = () => { if (name.trim()) onLoginJury(name.trim()); };
  
  return (
    <div className="mx-auto max-w-[480px] px-7 py-12 text-center max-[480px]:px-3.5 max-[480px]:py-6">
      <h2 className="mb-1.5 text-[26px] font-bold">Identifiez-vous</h2>
      <p className="mb-6 text-[15px] text-[var(--mid)]">{curSess?.name}</p>
      <input
        type="text"
        placeholder="Votre prénom..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
        className="mb-4 min-h-[42px] w-full rounded-[var(--radius)] border-[1.5px] border-[var(--border)] bg-[var(--paper)] p-[17px] text-center text-[19px] font-semibold text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
      />
      <Button onClick={submit}>
        Commencer <FiArrowRight />
      </Button>
      {jurors.length > 0 && (
        <div className="mt-6 text-left">
          <div className="mb-2.5 font-mono text-xs uppercase tracking-[0.5px] text-[var(--mid)]">Reprendre :</div>
          <div className="flex flex-wrap gap-2">
            {jurors.map(n => (
              <button key={n} className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-[18px] py-[11px] text-[15px] font-semibold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]" onClick={() => onLoginJury(n)}>{n}</button>
            ))}
          </div>
        </div>
      )}
      <Button variant="ghost" size="sm" className="mt-4" onClick={onGoBack || onHome}><FiArrowLeft /> Retour</Button>
    </div>
  );
};
