"use client";
import React from "react";
import { FiCheckCircle, FiPieChart } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { SessionConfig } from "../../../types";

interface DoneScreenProps {
  curSess: SessionConfig;
  resultsVisible?: boolean;
  onReviewAnswers: () => void;
  onShowSummary: () => void;
}

export const DoneScreen = ({ resultsVisible, onReviewAnswers, onShowSummary }: DoneScreenProps) => (
  <div className="done-screen">
    <div className="done-card">
      <FiCheckCircle size={64} className="done-icon" />
      <h1>Merci pour votre participation !</h1>
      <p className="sub">Vos réponses ont été enregistrées avec succès.</p>

      <div className="done-actions">
        <Button variant="ghost" onClick={onReviewAnswers}>Relire mes réponses</Button>
        {resultsVisible && (
          <Button onClick={onShowSummary} className="summary-btn">
            <FiPieChart /> Voir les résultats du panel
          </Button>
        )}
      </div>
    </div>
  </div>
);
