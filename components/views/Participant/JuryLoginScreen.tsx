"use client";
import React, { useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { Button } from "../../ui/Button";

interface JuryLoginScreenProps {
  onGoBack: () => void;
  jurors: string[];
  onLoginJury: (name: string) => void;
}

export const JuryLoginScreen = ({ onGoBack, jurors, onLoginJury }: JuryLoginScreenProps) => {
  const [name, setName] = useState("");
  const [showList, setShowList] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onLoginJury(name.trim());
  };

  return (
    <div className="jury-login">
      <header className="step-header">
        <button className="back-btn" onClick={onGoBack}><FiArrowLeft /> Retour</button>
        <h2>Votre identité</h2>
      </header>

      <form onSubmit={handleSubmit} className="login-form">
        <p className="sub">Entrez votre prénom ou choisissez-le dans la liste.</p>
        <div className="input-group">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Jean"
            className="login-input"
          />
          <Button type="submit" disabled={!name.trim()}>Suivant <FiArrowRight /></Button>
        </div>

        {jurors.length > 0 && (
          <div className="juror-list-toggle">
            <button type="button" onClick={() => setShowList(!showList)} className="text-btn">
              {showList ? "Masquer la liste" : "Déjà venu ? Choisir dans la liste"}
            </button>
            {showList && (
              <div className="juror-chips">
                {jurors.map(j => (
                  <button key={j} type="button" className="juror-chip" onClick={() => onLoginJury(j)}>{j}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
