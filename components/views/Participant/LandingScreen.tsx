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
    <div className="landing">
      <h1>Bienvenue sur<br /><em>CiderScope</em></h1>
      <p className="sub">Sélectionnez une séance pour participer</p>
      <div id="landingContent">
        {activeSessions.length === 0 ? (
          <div className="no-session">
            <FiClipboard size={36} className="block mx-auto mb-2 text-[var(--mid)]" />
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