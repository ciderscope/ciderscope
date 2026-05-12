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
    <div className="mx-auto my-[70px] max-w-[520px] p-7 text-center">
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] px-7 py-8 text-center shadow-[var(--shadow)] max-[480px]:px-[18px] max-[480px]:py-6">
        <h2 className="mb-2 text-[32px] font-extrabold text-[var(--ok)]">Terminé !</h2>
        <p className="mx-auto mb-8 max-w-[320px] text-sm leading-relaxed text-[var(--mid)]">
          Vos réponses ont été enregistrées avec succès. Merci de votre participation.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            className={[
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border-[1.5px] px-[18px] py-[11px] text-[14.5px] font-semibold transition-[background,border-color,color,transform]",
              resultsVisible
                ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,var(--paper))] text-[var(--accent)] hover:-translate-y-px hover:bg-[var(--accent)] hover:text-white"
                : "cursor-not-allowed border-[var(--border)] bg-[var(--paper2)] text-[var(--mid)] opacity-85",
            ].join(" ")}
            onClick={() => resultsVisible && onShowSummary()}       
            disabled={!resultsVisible}
            aria-disabled={!resultsVisible}
            title={resultsVisible ? "Voir le résumé du panel" : "L'animateur n'a pas encore débloqué le résumé"}
          >
            {resultsVisible ? "Voir les résultats du panel" : "Résultats (en attente de l'animateur)"}
          </button>
          {!resultsVisible && (
            <p className="mx-auto mt-2 max-w-[380px] text-[12.5px] text-[var(--mid)]">Le bouton deviendra cliquable dès que l&apos;animateur l&apos;aura autorisé.</p>      
          )}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
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
