"use client";
export const dynamic = "force-dynamic";

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
import { AnalyseView } from "../components/views/AnalyseView";
import { useSenso } from "../hooks/useSenso";

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

export default function CiderScope() {
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
    buildSteps,
    saveSession,
    deleteSession,
    toggleActive,
    loadSessions,
    loadSessionConfig,
  } = useSenso();

  return (
    <div>
      <Topbar
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          setScreen("landing");
          if (m === "analyse" && sessions.length && !anSessId) handleAnSessChange(sessions[0].id);
        }}
      />

      <main>
        {mode === "participant" && (
          <ParticipantView
            screen={screen}
            sessions={sessions}
            curSess={curSess}
            jurors={jurors}
            cj={cj}
            ja={ja}
            cs={cs}
            onSelectSession={handleSelectSession}
            onLoginJury={handleLoginJury}
            onSetJa={handleSetJa}
            onPrevStep={() => setCs(cs - 1)}
            onNextStep={() => {
              const steps = buildSteps(curSess!, cj);
              if (cs >= steps.length - 1) setScreen("done");
              else setCs(cs + 1);
            }}
            onGoBack={() => setScreen("jury")}
            onHome={() => setScreen("landing")}
            buildSteps={buildSteps}
          />
        )}

        {mode === "admin" && (
          <AdminView
            screen={screen}
            sessions={sessions}
            editCfg={editCfg}
            curEditTab={curEditTab}
            editSessId={editSessId}
            onNewSession={() => {
              setEditCfg({ name: "", date: new Date().toISOString().slice(0, 10), products: [], questions: [], presMode: "latin" });
              setEditSessId(null);
              setCurEditTab("session");
              setScreen("edit");
            }}
            onEditSession={async (id) => {
              const cfg = await loadSessionConfig(id);
              setEditCfg(cfg);
              setEditSessId(id);
              setCurEditTab("session");
              setScreen("edit");
            }}
            onToggleActive={toggleActive}
            onDuplicateSession={async (id) => {
              const c = await loadSessionConfig(id);
              if (!c) return;
              const nc = { ...c, name: c.name + " (copie)", date: new Date().toISOString().slice(0, 10) };
              const ni = "s" + Date.now();
              await saveSession(ni, nc, { active: false, jurorCount: 0 });
              await loadSessions();
            }}
            onDeleteSession={async (id) => {
              if (confirm("Supprimer cette séance ?")) {
                await deleteSession(id);
                await loadSessions();
              }
            }}
            onSetEditCfg={setEditCfg}
            onSetEditTab={setCurEditTab}
            onHome={() => setScreen("landing")}
            onSaveEdit={async () => {
              if (!editCfg) return;
              const id = editSessId || "s" + Date.now();
              const existing = sessions.find(s => s.id === id);
              await saveSession(id, editCfg, {
                active: existing?.active ?? false,
                jurorCount: existing?.jurorCount ?? 0,
              });
              await loadSessions();
              setScreen("landing");
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
            downloadCSV={(rows, name) => {
              if (rows.length === 0) return;
              const hd = Object.keys(rows[0]);
              const csv = "\ufeff" + [hd.join(";"), ...rows.map(r => hd.map(h => r[h]).join(";"))].join("\n");
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
              a.download = name + ".csv";
              a.click();
            }}
          />
        )}

        {mode === "analyse" && (
          <AnalyseView
            sessions={sessions}
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
