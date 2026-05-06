"use client";
import React, { useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { ConfirmModal } from "./ConfirmModal";

interface DoneScreenProps {
  resultsVisible?: boolean;
  onReviewAnswers: () => void;
  onShowSummary: () => void;
  onHome: () => void;
}

export const DoneScreen = ({ resultsVisible, onReviewAnswers, onShowSummary, onHome }: DoneScreenProps) => {
  const [confirmReview, setConfirmReview] = useState(false);

  return (
    <div className="done-screen">
      <div className="done-box">
        <h2 className="text-[32px] font-extrabold text-[var(--ok)] mb-2">Terminé !</h2>
        <p className="text-[14px] text-[var(--mid)] mb-8 max-w-[320px] mx-auto leading-relaxed">
          Vos réponses ont été enregistrées avec succès. Merci de votre participation.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            className={`done-summary-btn ${resultsVisible ? "done-summary-btn--ready" : "done-summary-btn--locked"}`}
            onClick={() => resultsVisible && onShowSummary()}       
            disabled={!resultsVisible}
            aria-disabled={!resultsVisible}
            title={resultsVisible ? "Voir le résumé du panel" : "L'animateur n'a pas encore débloqué le résumé"}
          >
            {resultsVisible ? "Voir les résultats du panel" : "Résultats (en attente de l'animateur)"}
          </button>
          {!resultsVisible && (
            <p className="done-summary-hint">Le bouton deviendra cliquable dès que l&apos;animateur l&apos;aura autorisé.</p>      
          )}
        </div>

        <div className="flex justify-center gap-4 mt-8 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setConfirmReview(true)}>Revoir mes réponses</Button>
          <Button variant="secondary" onClick={onHome}><FiArrowLeft /> Retour</Button>
        </div>

        {confirmReview && (
          <ConfirmModal
            tone="warn"
            title="Revoir les réponses ?"
            message="Vous allez retourner sur le questionnaire. Veuillez ne pas modifier vos réponses à moins d'une erreur manifeste."
            confirmLabel="Relire"
            cancelLabel="Annuler"
            onCancel={() => setConfirmReview(false)}
            onConfirm={() => {
              setConfirmReview(false);
              onReviewAnswers();
            }}
          />
        )}
      </div>
    </div>
  );
};