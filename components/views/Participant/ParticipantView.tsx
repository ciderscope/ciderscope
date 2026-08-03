"use client";
import React from "react";
import { JurorAnswers, SessionListItem, SessionConfig, SessionStep, AppScreen, SaveStatus, PosteDay } from "../../../types";
import { SaveIndicator } from "./utils";
import { LandingScreen } from "./LandingScreen";
import { PosteScreen } from "./PosteScreen";
import { JuryLoginScreen } from "./JuryLoginScreen";
import { OrderScreen } from "./OrderScreen";
import { FormScreen } from "./FormScreen";
import { DoneScreen } from "./DoneScreen";
import { SummaryScreen } from "./SummaryScreen";

interface ParticipantViewProps {
  screen: AppScreen;
  directAccess?: boolean;
  sessions: SessionListItem[];
  curSess: SessionConfig | null;
  curSessId: string | null;
  jurors: string[];
  cj: string;
  ja: JurorAnswers;
  cs: number;
  saveStatus: SaveStatus;
  pendingCount: number;
  takenPostes: Record<string, string>;
  onSelectPoste: (day: PosteDay, num: number) => void;
  onSelectSession: (id: string) => void;
  onLoginJury: (name: string) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onSetJa: (updater: JurorAnswers | ((prev: JurorAnswers) => JurorAnswers)) => void;
  onRequestHelp: () => void | Promise<{ success: boolean } | undefined>;
  onGoBack: () => void;
  onChangeJury: () => void;
  onReviewAnswers: () => void;
  onShowSummary: () => void;
  onStartFromOrder: () => void;
  summaryView: React.ReactNode | null;
  steps: SessionStep[];
  completion: boolean[];
  validatedCompletion: boolean[];
}

export const ParticipantView = (props: ParticipantViewProps) => {
  const { screen, saveStatus, pendingCount } = props;

  if (props.directAccess && !props.curSess) {
    return (
      <div className="mx-auto max-w-xl px-5 py-12 text-center">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)] p-7 shadow-[var(--shadow)]">
          <h1 className="mb-2 text-xl font-bold text-[var(--ink)]">Lien de séance indisponible</h1>
          <p className="text-sm text-[var(--mid)]">Demandez un nouveau lien à l&apos;animateur de la séance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`participant-shell screen-${screen}`}>
      <SaveIndicator status={saveStatus} pendingCount={pendingCount} />

      {screen === "landing" && (
        <LandingScreen
          sessions={props.sessions}
          onSelectSession={props.onSelectSession}
        />
      )}

      {screen === "poste" && (
        <PosteScreen
          onGoBack={props.onGoBack}
          takenPostes={props.takenPostes}
          onSelectPoste={props.onSelectPoste}
          cj={props.cj}
        />
      )}

      {screen === "jury" && (
        <JuryLoginScreen
          curSess={props.curSess}
          jurors={props.jurors}
          onLoginJury={props.onLoginJury}
          onGoBack={props.directAccess ? undefined : props.onGoBack}
        />
      )}

      {screen === "order" && props.curSess && (
        <OrderScreen
          curSess={props.curSess}
          cj={props.cj}
          steps={props.steps}
          onStartFromOrder={props.onStartFromOrder}
          onGoBack={props.onGoBack}
        />
      )}

      {screen === "form" && props.curSess && (
        <FormScreen
          onChangeJury={props.onChangeJury}
          steps={props.steps}
          cs={props.cs}
          completion={props.completion}
          validatedCompletion={props.validatedCompletion}
          onPrevStep={props.onPrevStep}
          onNextStep={props.onNextStep}
          curSess={props.curSess}
          cj={props.cj}
          ja={props.ja}
          onSetJa={props.onSetJa}
          onRequestHelp={props.onRequestHelp}
        />
      )}

      {screen === "done" && props.curSess && (
        <DoneScreen
          resultsVisible={props.sessions.find(s => s.id === props.curSessId)?.resultsVisible}
          onReviewAnswers={props.onReviewAnswers}
          onShowSummary={props.onShowSummary}
          onGoBack={props.onGoBack}
        />
      )}

      {screen === "summary" && (
        <SummaryScreen
          onGoBack={props.onGoBack}
          summaryView={props.summaryView}
        />
      )}
    </div>
  );
};
