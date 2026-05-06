"use client";
import React from "react";
import { FiArrowLeft } from "react-icons/fi";
import { PosteDay } from "../../../types";

interface PosteScreenProps {
  onGoBack: () => void;
  takenPostes: Record<string, string>;
  onSelectPoste: (day: PosteDay, num: number) => void;
}

export const PosteScreen = ({ onGoBack, takenPostes, onSelectPoste }: PosteScreenProps) => {
  const days: PosteDay[] = ["M", "A"];
  const postes = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="poste-selection">
      <header className="step-header">
        <button className="back-btn" onClick={onGoBack}><FiArrowLeft /> Retour</button>
        <h2>Votre poste de dégustation</h2>
      </header>

      <p className="sub">Choisissez votre numéro de poste pour cette demi-journée.</p>

      <div className="poste-grid-container">
        {days.map(day => (
          <div key={day} className="day-section">
            <h3 className="day-title">{day === "M" ? "Matin" : "Après-midi"}</h3>
            <div className="poste-grid">
              {postes.map(num => {
                const key = `${day}${num}`;
                const takenBy = takenPostes[key];
                return (
                  <button
                    key={num}
                    className={`poste-btn ${takenBy ? "taken" : ""}`}
                    disabled={!!takenBy}
                    onClick={() => onSelectPoste(day, num)}
                    title={takenBy ? `Occupé par ${takenBy}` : `Poste ${num}`}
                  >
                    <span className="num">{num}</span>
                    {takenBy && <span className="taken-by">{takenBy}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
