"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";

import { ParticipantView } from "../components/views/Participant/ParticipantView";
import { AdminLoginView } from "../components/views/Admin/AdminLoginView";
import { HomeScreen } from "../components/views/Home/HomeScreen";
import { validateSession } from "../lib/validation";
import { hsh } from "../lib/utils";
import { useApp } from "./AppProviders";

import { downloadCSV } from "../lib/csv";

// L'admin n'est jamais chargé côté participant — split du bundle.
const AdminView = dynamic(() => import("../components/views/Admin/AdminView").then(m => m.AdminView), {
  ssr: false,
  loading: () => <div className="p-8 text-[var(--mid)]">Chargement...</div>,
});

// AnalyseView (Chart.js) chargée à la demande aussi côté participant pour
// le résumé de fin de séance — ne pèse pas sur le bundle initial.
const AnalyseView = dynamic(() => import("../components/views/Analyse/AnalyseView").then(m => m.AnalyseView), {
  ssr: false,
  loading: () => <div className="p-8 text-[var(--mid)]">Chargement du résumé...</div>,
});

const fingerprint = (cfg: unknown) => hsh(JSON.stringify(cfg));

export default function CiderScope() {
  const editFingerprintRef = useRef<number | null>(null);

  const {
    mode, setMode, screen, setScreen,
    sessions,
    curSess, curSessId,
    jurors, cj, ja, cs, setCs,
    takenPostes, validatedSteps, handleSelectPoste, validateStep,
    handleSelectSession, handleLoginJury, handleSetJa,
    editCfg, setEditCfg,
    editSessId, setEditSessId,
    curEditTab, setCurEditTab,
    anSessId, anCfg, curAnT, setCurAnT,
    adminSection, setAdminSection,
    handleAnSessChange,
    allAnswers,
    saveSession,
    deleteSession,
    deleteJury,
    listJurorsForSession,
    toggleActive,
    toggleResultsVisible,
    loadSessions,
    loadSessionConfig,
    saveStatus,
    pendingCount,
    isStepComplete,
    currentSteps,
    completion,
    flushSave,
    adminAuth, setAdminAuth,
    restored,
  } = useApp();

  if (!restored) {
    return <div className="p-8 text-center text-[var(--mid)]">Initialisation de l&apos;application...</div>;
  }

  const goHome = () => {
    setMode("home");
    setScreen("landing");
  };

  if (mode === "home") {
    return (
      <HomeScreen
        onSelectParticipant={() => { setMode("participant"); setScreen("landing"); }}
        onSelectAdmin={() => { setMode("admin"); setScreen("landing"); }}
      />
    );
  }

  if (mode === "participant") {
    // Le résumé du panel n'est monté que quand le participant entre l'écran "summary",
    // et seulement si la séance courante a son `resultsVisible` à true. anCfg/allAnswers
    // sont préchargés via handleAnSessChange au clic sur "Voir le résumé".
    const summaryView = (screen === "summary" && anCfg && anSessId === curSessId)
      ? (
        <AnalyseView
          sessions={sessions}
          anSessId={anSessId}
          anCfg={anCfg}
          allAnswers={allAnswers}
          curAnT={curAnT}
          onAnSessChange={() => { /* non interactif côté participant */ }}
          onAnTabChange={setCurAnT}
          participantMode
          currentJuror={cj}
        />
      )
      : null;

    return (
      <ParticipantView
        screen={screen}
        sessions={sessions}
        curSess={curSess}
        curSessId={curSessId}
        jurors={jurors}
        cj={cj}
        ja={ja}
        cs={cs}
        saveStatus={saveStatus}
        pendingCount={pendingCount}
        takenPostes={takenPostes}
        validatedSteps={validatedSteps}
        onSelectPoste={handleSelectPoste}
        onValidateStep={validateStep}
        onSelectSession={handleSelectSession}
        onLoginJury={handleLoginJury}
        onSetJa={handleSetJa}
        onPrevStep={() => setCs(prev => Math.max(0, prev - 1))}
        onNextStep={() => {
          if (!isStepComplete(cs)) return;
          if (cs >= currentSteps.length - 1) {
            handleSetJa(prev => ({ ...prev, _finished: true }));
            void flushSave();
            setScreen("done");
          } else {
            void flushSave();
            setCs(prev => Math.min(currentSteps.length - 1, prev + 1));
          }
        }}
        onGoBack={goHome}
        onHome={goHome}
        onChangeJury={() => setScreen("jury")}
        onReviewAnswers={() => handleLoginJury(cj, { review: true })}
        onShowSummary={async () => {
          if (!curSessId) return;
          await handleAnSessChange(curSessId);
          setScreen("summary");
        }}
        onStartFromOrder={() => setScreen("form")}
        summaryView={summaryView}
        steps={currentSteps}
        completion={completion}
      />
    );
  }

  if (mode === "admin" && !adminAuth) {
    return <AdminLoginView onSuccess={() => setAdminAuth(true)} />;
  }

  return (
    <AdminView
      screen={screen}
      sessions={sessions}
      editCfg={editCfg}
      curEditTab={curEditTab}
      editSessId={editSessId}
      adminSection={adminSection}
      setAdminSection={setAdminSection}
      onNewSession={() => {
        setEditCfg({ name: "", date: new Date().toISOString().slice(0, 10), products: [], questions: [], presMode: "latin" });
        setEditSessId(null);
        editFingerprintRef.current = null;
        setCurEditTab("session");
        setScreen("edit");
      }}
      onEditSession={async (id) => {
        const cfg = await loadSessionConfig(id);
        setEditCfg(cfg);
        setEditSessId(id);
        editFingerprintRef.current = cfg ? fingerprint(cfg) : null;
        setCurEditTab("session");
        setScreen("edit");
      }}
      onToggleActive={toggleActive}
      onToggleResultsVisible={toggleResultsVisible}
      onDuplicateSession={async (id) => {
        const c = await loadSessionConfig(id);
        if (!c) return;
        const nc = { ...c, name: c.name + " (copie)", date: new Date().toISOString().slice(0, 10) };
        const ni = "s" + Date.now();
        const res = await saveSession(ni, nc, { active: false, jurorCount: 0 });
        if (res.success) await loadSessions();
        else alert("Erreur lors de la duplication.");
      }}
      onDeleteSession={async (id) => {
        await deleteSession(id);
        await loadSessions();
      }}
      onSetEditCfg={setEditCfg}
      onSetEditTab={setCurEditTab}
      onHome={goHome}
      onSaveEdit={async () => {
        if (!editCfg) return;
        const errs = validateSession(editCfg);
        if (errs.length > 0) {
          alert("Configuration incomplète :\n\n• " + errs.join("\n• "));
          return;
        }
        // Verrouillage optimiste : on vérifie que la version serveur n'a pas changé depuis l'ouverture.
        if (editSessId && editFingerprintRef.current !== null) {
          const current = await loadSessionConfig(editSessId);
          if (current && fingerprint(current) !== editFingerprintRef.current) {
            const ok = confirm("Cette séance a été modifiée ailleurs depuis que vous l'avez ouverte. Écraser ces modifications ?");
            if (!ok) return;
          }
        }
        const id = editSessId || "s" + Date.now();
        const existing = sessions.find(s => s.id === id);
        const res = await saveSession(id, editCfg, {
          active: existing ? existing.active : true,
          jurorCount: existing?.jurorCount ?? 0,
          resultsVisible: existing?.resultsVisible ?? false,
        });
        if (res.success) {
          editFingerprintRef.current = fingerprint(editCfg);
          await loadSessions();
          setScreen("landing");
        } else {
          alert("Erreur lors de l'enregistrement.");
        }
      }}
      downloadCSV={downloadCSV}
      listJurorsForSession={listJurorsForSession}
      deleteJury={deleteJury}
      allAnswers={allAnswers}
      anSessId={anSessId}
      anCfg={anCfg}
      curAnT={curAnT}
      onAnSessChange={handleAnSessChange}
      onAnTabChange={setCurAnT}
    />
  );
}
