"use client";
import React, { useState } from "react";
import { FiCalendar, FiClipboard } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { SessionListItem } from "../../../types";
import { SlotSignupView } from "./SlotSignupView";

interface LandingScreenProps {
  sessions: SessionListItem[];
  onSelectSession: (id: string) => void;
}

type ParticipantLandingPanel = "sessions" | "slots";

const panelButtonClass = (active: boolean) => [
  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold transition-[background,border-color,color,box-shadow] duration-150",
  active
    ? "border-[var(--primary)] bg-[rgba(98,141,23,.10)] text-[var(--primary)] shadow-[var(--shadow)]"
    : "border-[var(--border)] bg-[var(--paper)] text-[var(--mid)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]",
].join(" ");

export const LandingScreen = ({ sessions, onSelectSession }: LandingScreenProps) => {
  const [activePanel, setActivePanel] = useState<ParticipantLandingPanel>("sessions");
  const activeSession = sessions.find(session => session.active);

  return (
    <div className="mx-auto max-w-[min(94%,1500px)] px-7 py-12 text-center max-[480px]:px-3.5 max-[480px]:py-6">
      <h1 className="mb-2.5 text-4xl font-extrabold leading-[1.08] tracking-normal text-[var(--ink)] max-[480px]:text-2xl max-[480px]:leading-tight">
        Bienvenue sur<br /><span className="text-[var(--accent)]">CiderScope</span>
      </h1>
      <p className="mb-6 text-[15px] text-[var(--mid)] max-[480px]:mb-5 max-[480px]:text-[13px]">
        Choisissez votre action.
      </p>

      <div className="mx-auto mb-8 flex max-w-[760px] flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--paper2)] p-1.5 sm:flex-row">
        <button
          type="button"
          className={panelButtonClass(activePanel === "sessions")}
          onClick={() => setActivePanel("sessions")}
        >
          <FiClipboard /> Rejoindre une séance
        </button>
        <button
          type="button"
          className={panelButtonClass(activePanel === "slots")}
          onClick={() => setActivePanel("slots")}
        >
          <FiCalendar /> S&apos;inscrire ou annuler un créneau
        </button>
      </div>

      {activePanel === "slots" && <SlotSignupView />}

      {activePanel === "sessions" && (
        <div className="flex flex-col items-center gap-3 py-6 max-[480px]:py-3">
          <Button
            type="button"
            className="!min-h-16 w-full max-w-[520px] justify-center !px-8 !text-lg !font-extrabold shadow-[0_8px_24px_rgba(98,141,23,.22)] max-[480px]:!min-h-14 max-[480px]:!px-5 max-[480px]:!text-base"
            disabled={!activeSession}
            onClick={() => {
              if (activeSession) onSelectSession(activeSession.id);
            }}
          >
            <FiClipboard size={22} aria-hidden="true" />
            Rejoindre la séance en cours
          </Button>
          {!activeSession && (
            <p className="text-sm text-[var(--mid)]">Aucune séance n&apos;est ouverte actuellement.</p>
          )}
        </div>
      )}
    </div>
  );
};
