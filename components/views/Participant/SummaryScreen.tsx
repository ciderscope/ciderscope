"use client";
import React from "react";
import { FiArrowLeft } from "react-icons/fi";

interface SummaryScreenProps {
  onGoBack: () => void;
  summaryView: React.ReactNode;
}

export const SummaryScreen = ({ onGoBack, summaryView }: SummaryScreenProps) => (
  <div className="summary-screen">
    <header className="step-header">
      <button className="back-btn" onClick={onGoBack}><FiArrowLeft /> Retour</button>
      <h2>Analyse du panel</h2>
    </header>
    <div className="summary-scroll-area">
      {summaryView}
    </div>
  </div>
);
