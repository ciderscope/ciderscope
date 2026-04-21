"use client";

import { useEffect, useRef, useState } from "react";
import { hsh } from "../lib/utils";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";

import { Topbar } from "../components/ui/Topbar";
import { ParticipantView } from "../components/views/ParticipantView";
import { AdminView } from "../components/views/AdminView";
import { AdminLoginView } from "../components/views/AdminLoginView";
import { useSenso } from "../hooks/useSenso";
import { validateSession } from "../lib/validation";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
);

const downloadCSV = (rows: any[], name: string) => {
  if (rows.length === 0) return;
  const hd = Object.keys(rows[0]);
  const csv = "\ufeff" + [hd.join(";"), ...rows.map(r => hd.map(h => r[h]).join(";"))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name + ".csv";
  a.click();
};

const fingerprint = (cfg: unknown) => hsh(JSON.stringify(cfg));

export default function CiderScope() {
  // Initialize state directly from sessionStorage to avoid synchronous setState in useEffect
  const [adminAuth, setAdminAuth] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("admin_auth") === "1";
    }
    return false;
  });
  const editFingerprintRef = useRef<number | null>(null);

  useEffect(() => {
    // Sync if needed, though initialization usually handles it
    const authed = sessionStorage.getItem("admin_auth") === "1";
    if (authed !== adminAuth) setAdminAuth(authed);
  }, [adminAuth]);

  const {
    mode, setMode,
    screen, setScreen,
    sessions,
    curSess,
    jurors, cj, ja, cs, setCs,
    handleSelectSession, handleLoginJury, handleSetJa,
    editCfg, setEditCfg,
    editSessId, setEditSessId,
    curEditTab, setCurEditTab,
    anSessId, anCfg, csvData, curAnT, setCurAnT,
    handleAnSessChange,
    allAnswers,
    buildSteps,
    saveSession,
    deleteSession,
    deleteJury,
    listJurorsForSession,
    toggleActive,
    loadSessions,
    loadSessionConfig,
    online,
    saveStatus,
    pendingCount,
    isStepComplete,
  } = useSenso();

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    setAdminAuth(false);
  };

  return (
    <div>
      <Topbar
        mode={mode}
        online={online}
        onModeChange={(m) => {
          setMode(m);
          setScreen("landing");
        }}
        onLogout={adminAuth === true ? handleLogout : undefined}
      />

      <main className="app-main">
        {mode === "participant" && (
          <ParticipantView
            screen={screen}
            sessions={sessions}
            curSess={curSess}
            jurors={jurors}
            cj={cj}
            ja={ja}
            cs={cs}
            saveStatus={saveStatus}
            pendingCount={pendingCount}
            onSelectSession={handleSelectSession}
            onLoginJury={handleLoginJury}
            onSetJa={handleSetJa}
            onPrevStep={() => setCs(cs - 1)}
            onNextStep={() => {
              const steps = buildSteps(curSess!, cj);
              if (!isStepComplete(cs)) return;
              if (cs >= steps.length - 1) setScreen("done");
              else setCs(cs + 1);
            }}
            onGoBack={() => setScreen("jury")}
            onHome={() => setScreen("landing")}
            onReviewAnswers={() => handleLoginJury(cj)}
            buildSteps={buildSteps}
            isStepComplete={isStepComplete}
          />
        )}

        {mode === "admin" && adminAuth === false && (
          <AdminLoginView onSuccess={() => setAdminAuth(true)} />
        )}

        {mode === "admin" && adminAuth === true && (
          <AdminView
            screen={screen}
            sessions={sessions}
            editCfg={editCfg}
            curEditTab={curEditTab}
            editSessId={editSessId}
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
            onHome={() => setScreen("landing")}
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
              });
              if (res.success) {
                editFingerprintRef.current = fingerprint(editCfg);
                await loadSessions();
                setScreen("landing");
              } else {
                alert("Erreur lors de l'enregistrement.");
              }
            }}
            buildCSVRows={(cfg, ans) => {
              const rows: any[] = [];
              cfg.questions.filter((q: any) => q.scope === "per-product").forEach((q: any) => {
                Object.entries(ans).forEach(([j, ja]: [string, any]) => {
                  cfg.products.forEach((p: any) => rows.push({ jury: j, produit: p.code, question: q.label, valeur: ja[p.code]?.[q.id] }));
                });
              });
              return rows;
            }}
            downloadCSV={downloadCSV}
            loadSessionConfig={loadSessionConfig}
            listJurorsForSession={listJurorsForSession}
            deleteJury={deleteJury}
            allAnswers={allAnswers}
            anSessId={anSessId}
            anCfg={anCfg}
            csvData={csvData}
            curAnT={curAnT}
            onAnSessChange={handleAnSessChange}
            onAnTabChange={setCurAnT}
          />
        )}
      </main>
    </div>
  );
}
