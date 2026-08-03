"use client";
import React, { useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { SessionConfig } from "../../../types";
import { formatSlotDateLong } from "../../../lib/slots/dates";

interface JuryLoginScreenProps {
  curSess: SessionConfig | null;
  jurors: string[];
  onLoginJury: (name: string) => void;
  onGoBack?: () => void;
}

export const JuryLoginScreen = ({ curSess, onLoginJury, onGoBack }: JuryLoginScreenProps) => {
  const [name, setName] = useState("");
  const submit = () => { if (name.trim()) onLoginJury(name.trim()); };
  
  return (
    <div className="mx-auto max-w-[480px] px-7 py-12 text-center max-[480px]:px-3.5 max-[480px]:py-6">
      <h2 className="mb-1.5 text-[26px] font-bold">Identifiez-vous</h2>
      <p className="mb-6 text-[15px] text-[var(--mid)]">{curSess ? formatSlotDateLong(curSess.date) : ""}</p>
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
      {onGoBack && (
        <Button variant="ghost" size="sm" className="mt-4" onClick={onGoBack}><FiArrowLeft /> Retour</Button>
      )}
    </div>
  );
};
