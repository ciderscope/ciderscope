"use client";
import React from "react";
import { FiArrowLeft } from "react-icons/fi";
import { Button } from "../../ui/Button";

interface SummaryScreenProps {
  onGoBack: () => void;
  summaryView: React.ReactNode;
}

export const SummaryScreen = ({ onGoBack, summaryView }: SummaryScreenProps) => (
  <div className="mx-auto max-w-[min(96%,1200px)] px-3.5 py-4 pb-20 max-[480px]:px-2 max-[480px]:py-2.5 max-[480px]:pb-20">
    <header className="mb-3.5 flex items-center gap-3.5 border-b border-[var(--border)] px-1 py-3 pb-4 max-[480px]:gap-2.5 max-[480px]:px-0.5 max-[480px]:py-2 max-[480px]:pb-3">
      <Button variant="secondary" size="sm" onClick={onGoBack}><FiArrowLeft /> Retour</Button>
      <h2 className="text-[19px] font-extrabold tracking-normal max-[480px]:text-[16.5px]">Analyse du panel</h2>
    </header>
    <div className="flex flex-col gap-3.5">
      {summaryView}
    </div>
  </div>
);
