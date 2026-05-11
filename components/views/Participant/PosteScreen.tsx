"use client";
import React from "react";
import { FiArrowLeft } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { PosteDay } from "../../../types";

interface PosteScreenProps {
  onGoBack: () => void;
  takenPostes: Record<string, string>;
  onSelectPoste: (day: PosteDay, num: number) => void;
  cj: string; // current juror
}

export const PosteScreen = ({ onGoBack, takenPostes, onSelectPoste, cj }: PosteScreenProps) => {
  const days: PosteDay[] = ["mardi", "jeudi"];
  const numbers = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="poste-screen">
      <h2>Votre poste</h2>
      <p className="hint">
        Sélectionnez le numéro indiqué sur votre feuille de service.
      </p>
      <div className="poste-grid">
        {days.map(d => (
          <div key={d} className="poste-col">
            <h3 className="poste-col-title">{d.charAt(0).toUpperCase() + d.slice(1)}</h3>
            <div className="poste-list">
              {numbers.map(n => {
                const key = `${d}-${n}`;
                const owner = takenPostes[key];
                const taken = !!owner && owner !== cj;
                const mine = owner === cj;
                return (
                  <button
                    key={n}
                    type="button"
                    className={`poste-btn ${taken ? "taken" : ""} ${mine ? "mine" : ""}`}
                    onClick={() => !taken && onSelectPoste(d, n)}
                    disabled={taken}
                    title={taken ? `Pris par ${owner}` : `Poste ${n}`}
                  >
                    <span className="poste-num">{n}</span>
                    {taken && <span className="poste-owner">{owner}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt16" onClick={onGoBack}><FiArrowLeft /> Retour</Button>
    </div>
  );
};