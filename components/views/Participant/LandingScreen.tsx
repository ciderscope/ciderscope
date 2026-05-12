"use client";
import React from "react";
import { FiClipboard } from "react-icons/fi";
import { SessionCard } from "../../features/SessionCard";
import { SessionListItem } from "../../../types";

interface LandingScreenProps {
  sessions: SessionListItem[];
  onSelectSession: (id: string) => void;
}

export const LandingScreen = ({ sessions, onSelectSession }: LandingScreenProps) => {
  const activeSessions = sessions.filter(s => s.active);
  return (
    <div className="mx-auto max-w-[min(94%,1500px)] px-7 py-12 text-center max-[480px]:px-3.5 max-[480px]:py-6">
      <h1 className="mb-2.5 text-4xl font-extrabold leading-[1.08] tracking-normal text-[var(--ink)] max-[480px]:text-2xl max-[480px]:leading-tight">
        Bienvenue sur<br /><span className="text-[var(--accent)]">CiderScope</span>
      </h1>
      <p className="mb-8 text-[15px] text-[var(--mid)] max-[480px]:mb-5 max-[480px]:text-[13px]">Sélectionnez une séance pour participer</p>
      <div className="text-left md:grid md:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] md:gap-2.5 lg:grid-cols-[repeat(auto-fill,minmax(270px,1fr))] lg:gap-3 xl:grid-cols-[repeat(auto-fill,minmax(290px,1fr))] 2xl:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
        {activeSessions.length === 0 ? (
          <div className="rounded-[var(--radius)] border-2 border-dashed border-[var(--border)] bg-[var(--paper2)] p-10 text-center text-[15px] text-[var(--mid)]">
            <FiClipboard size={36} className="mx-auto mb-2 block text-[var(--mid)]" />
            <strong>Aucune séance active</strong>
          </div>
        ) : (
          activeSessions.map(s => (
            <SessionCard
              key={s.id}
              name={s.name}
              date={s.date}
              jurorCount={s.jurorCount}
              productCount={s.productCount}
              questionCount={s.questionCount}
              onClick={() => onSelectSession(s.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
