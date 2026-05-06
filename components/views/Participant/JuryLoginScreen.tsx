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
    <div className="jury-login">
      <h2>Identifiez-vous</h2>
      <p className="hint">{curSess?.name}</p>
      <div className="jury-input-wrap">
        <input
          type="text"
          placeholder="Votre prénom…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
      </div>
      <Button onClick={submit}>
        Commencer <FiArrowRight />
      </Button>
      {jurors.length > 0 && (
        <div className="jury-existing">
          <div className="jury-existing-title">Reprendre :</div>
          <div className="jury-existing-grid">
            {jurors.map(n => (
              <button key={n} className="jury-existing-btn" onClick={() => onLoginJury(n)}>{n}</button>
            ))}
          </div>
        </div>
      )}
      <Button variant="ghost" size="sm" className="mt16" onClick={onGoBack || onHome}><FiArrowLeft /> Retour</Button>
    </div>
  );
};