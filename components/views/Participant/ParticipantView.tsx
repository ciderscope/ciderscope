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
  onSelectPoste: (day: PosteDay, num: number) => void;
  onValidateStep: (idx: number) => void;
  onSelectSession: (id: string) => void;
  onLoginJury: (name: string) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onSetJa: (updater: JurorAnswers | ((prev: JurorAnswers) => JurorAnswers)) => void;
  onGoBack: () => void;
  onHome: () => void;
  onChangeJury: () => void;
  onReviewAnswers: () => void;
  onShowSummary: () => void;
  onStartFromOrder: () => void;
  summaryView: React.ReactNode | null;
  steps: SessionStep[];
  completion: boolean[];
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
          cj={props.cj}
        />
      )}

      {screen === "jury" && (
        <JuryLoginScreen
          curSess={props.curSess}
          jurors={props.jurors}
          onLoginJury={props.onLoginJury}
          onHome={props.onHome}
          onGoBack={props.onGoBack}
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
          resultsVisible={props.sessions.find(s => s.id === props.curSessId)?.resultsVisible}
          onReviewAnswers={props.onReviewAnswers}
          onShowSummary={props.onShowSummary}
          onHome={props.onHome}
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
