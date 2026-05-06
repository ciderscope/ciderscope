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
  validatedSteps: Set<number>;
  onSelectPoste: (day: PosteDay, num: number) => void;
  onValidateStep: (idx: number) => void;
  onSelectSession: (id: string) => void;
  onLoginJury: (name: string) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onSetJa: (ja: JurorAnswers) => void;
  onGoBack: () => void;
  onHome: () => void;
  onReviewAnswers: () => void;
  onShowSummary: () => void;
  onStartFromOrder: () => void;
  summaryView: React.ReactNode | null;
  steps: SessionStep[];
  completion: boolean[];
  buildSteps: (cfg: SessionConfig, name: string) => SessionStep[];
  isStepComplete: (idx: number) => boolean;
}

export const ParticipantView = (props: ParticipantViewProps) => {
  const { screen, saveStatus, pendingCount } = props;

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
        />
      )}

      {screen === "jury" && (
        <JuryLoginScreen
          onGoBack={props.onGoBack}
          jurors={props.jurors}
          onLoginJury={props.onLoginJury}
        />
      )}

      {screen === "order" && (
        <OrderScreen
          onGoBack={props.onGoBack}
          steps={props.steps}
          onStartFromOrder={props.onStartFromOrder}
        />
      )}

      {screen === "form" && props.curSess && (
        <FormScreen
          onHome={props.onHome}
          steps={props.steps}
          cs={props.cs}
          completion={props.completion}
          isStepComplete={props.isStepComplete}
          onPrevStep={props.onPrevStep}
          onNextStep={props.onNextStep}
          curSess={props.curSess}
          cj={props.cj}
          ja={props.ja}
          onSetJa={props.onSetJa}
          onValidateStep={props.onValidateStep}
        />
      )}

      {screen === "done" && props.curSess && (
        <DoneScreen
          curSess={props.curSess}
          onReviewAnswers={props.onReviewAnswers}
          onShowSummary={props.onShowSummary}
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
