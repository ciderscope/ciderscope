"use client";
import { useState, useEffect, useMemo } from "react";
import { SessionListItem, SessionConfig, Question, JurorAnswers, BetLevel, Product, SessionStep, CSVRow, AllAnswers, AppMode, AppScreen, SaveStatus } from "../types";
import { hsh, wlm, formatVal } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { queuePending, clearPending, listPending, countPending } from "../lib/offlineQueue";

export const useSenso = () => {
  const [mode, setMode] = useState<AppMode>("participant");
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [curSessId, setCurSessId] = useState<string | null>(null);
  const [curSess, setCurSess] = useState<SessionConfig | null>(null);
  const [jurors, setJurors] = useState<string[]>([]);
  const [cj, setCj] = useState<string>("");
  const [ja, setJa] = useState<JurorAnswers>({});
  const [cs, setCs] = useState<number>(0);
  const [editCfg, setEditCfg] = useState<SessionConfig | null>(null);
  const [editSessId, setEditSessId] = useState<string | null>(null);
  const [curEditTab, setCurEditTab] = useState<string>("session");
  const [anSessId, setAnSessId] = useState<string | null>(null);
  const [anCfg, setAnCfg] = useState<SessionConfig | null>(null);
  const [allAnswers, setAllAnswers] = useState<AllAnswers>({});
  const [curAnT, setCurAnT] = useState<string>("profil");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load session list on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, name, date, active, juror_count, config")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Erreur lors du chargement des séances:", error);
      setOnline(false);
    } else if (data) {
      setOnline(true);
      type SessionRow = {
        id: string;
        name: string;
        date: string;
        active: boolean;
        juror_count: number;
        config: SessionConfig | null;
      };
      setSessions((data as SessionRow[]).map(r => {
        const cfg = r.config;
        return {
          id: r.id,
          name: r.name,
          date: r.date,
          active: r.active,
          jurorCount: r.juror_count,
          productCount: cfg?.products?.length || 0,
          questionCount: cfg?.questions?.length || 0,
        };
      }));
    }
    setLoading(false);
  };

  const saveSessions = async (newList: SessionListItem[]) => {
    setSessions(newList);
  };

  const loadSessionConfig = async (id: string): Promise<SessionConfig | null> => {
    const { data, error } = await supabase
      .from("sessions")
      .select("config")
      .eq("id", id)
      .single();
    if (error || !data) {
      console.error("Erreur lors du chargement de la config:", error);
      return null;
    }
    return data.config as SessionConfig;
  };

  const handleSelectSession = async (id: string) => {
    const cfg = await loadSessionConfig(id);
    if (!cfg) return;
    setCurSessId(id);
    setCurSess(cfg);
    const { data, error } = await supabase
      .from("answers")
      .select("juror_name")
      .eq("session_id", id);
    if (error) console.error("Erreur lors du chargement des jurys:", error);
    setJurors(data ? (data as { juror_name: string }[]).map(r => r.juror_name) : []);
    setScreen("jury");
  };

  const isStepDone = (s: SessionStep, currentJa: JurorAnswers) => {
    if (s.type === "product") return !!currentJa[s.product.code] && s.questions.some(q => currentJa[s.product.code][q.id] != null);
    if (s.type === "ranking") return !!currentJa["_rank"] && currentJa["_rank"][s.question.id] != null;
    if (s.type === "discrim") return !!currentJa["_discrim"] && currentJa["_discrim"][s.question.id] != null;
    if (s.type === "global") return !!currentJa["_global"] && s.questions.some(q => currentJa["_global"][q.id] != null);
    return false;
  };

  const getJurorIndex = (name: string, jurorList: string[]) => {
    const idx = jurorList.indexOf(name);
    return idx >= 0 ? idx : jurorList.length;
  };

  const getOrderedItems = <T,>(items: T[], mode: string, name: string, jurorList: string[], sessionName: string): T[] => {
    if (!items || items.length === 0) return [];
    if (mode === "fixed") return [...items];

    const idx = getJurorIndex(name, jurorList);

    if (mode === "latin") {
      const sq = wlm(items.length);
      return sq[idx % sq.length].map((i: number) => items[i]);
    }
    
    // Random mode: use a stable seed based on session + juror name
    const a = [...items];
    let sd = hsh((sessionName || "") + name);
    for (let k = a.length - 1; k > 0; k--) {
      sd = ((sd * 1103515245 + 12345) & 0x7fffffff);
      [a[k], a[sd % (k + 1)]] = [a[sd % (k + 1)], a[k]];
    }
    return a;
  };

  const buildSteps = (cfg: SessionConfig, jurorName: string, jurorList?: string[]) => {
    if (!cfg) return [];
    const jl = jurorList || jurors;
    const mode = cfg.presMode || "fixed";
    
    const steps: SessionStep[] = [];
    
    // 1. Per-product questions: organize by product to ensure each product is shown only once
    const ppQuestions = cfg.questions.filter(q => q.scope === "per-product");
    
    // Identify which products need to be evaluated and which questions apply to each
    const productMap = new Map<string, Question[]>();
    
    ppQuestions.forEach(q => {
      const targetCodes = q.codes?.length ? q.codes : cfg.products.map(p => p.code);
      targetCodes.forEach(code => {
        if (!productMap.has(code)) productMap.set(code, []);
        productMap.get(code)!.push(q);
      });
    });

    if (productMap.size > 0) {
      const activeCodes = Array.from(productMap.keys());
      // Important: only randomize products that are actually part of the evaluation
      const orderedCodes = getOrderedItems(activeCodes, mode, jurorName, jl, cfg.name);
      
      orderedCodes.forEach(code => {
        const product = cfg.products.find(p => p.code === code) || { code };
        const questions = productMap.get(code) || [];
        steps.push({ type: "product", product, questions });
      });
    }

    // 2. Standalone questions (ranking, discrim, global)
    const standaloneQuestions = cfg.questions.filter(q => q.scope !== "per-product");
    
    // Separate globals from series (ranking/discrim)
    const seriesQuestions = standaloneQuestions.filter(q => q.type !== "text" && q.type !== "qcm" && q.scope !== "global");
    const globalQuestions = standaloneQuestions.filter(q => q.type === "text" || q.type === "qcm" || q.scope === "global");

    // Randomize the order of the series themselves if requested
    const orderedSeries = getOrderedItems(seriesQuestions, mode, jurorName, jl, cfg.name + "series");

    orderedSeries.forEach(q => {
      const type = (q.type === "classement" || q.type === "seuil") ? "ranking" : "discrim";
      
      let finalCodes = [...(q.codes || [])];
      if (finalCodes.length === 0 && (q.type === "classement" || q.type === "seuil")) {
        finalCodes = cfg.products.map(p => p.code);
      }
      
      // Randomize the codes for this juror
      let randomizedCodes: string[];
      if (q.type === "duo-trio") {
        // For Duo-Trio, we often want to keep the test sample at the end or randomize refs only
        // But let's follow the general rule unless specified
        randomizedCodes = getOrderedItems(finalCodes, mode, jurorName, jl, cfg.name + q.id);
      } else {
        randomizedCodes = getOrderedItems(finalCodes, mode, jurorName, jl, cfg.name + q.id);
      }
      
      const finalQ = { ...q, codes: randomizedCodes };

      // Deep randomization for complex types
      if (q.type === "seuil-bet" && q.betLevels) {
        finalQ.betLevels = q.betLevels.map((lv: BetLevel, lIdx: number) => ({
          ...lv,
          codes: getOrderedItems([...lv.codes], mode, jurorName, jl, cfg.name + q.id + "l" + lIdx) as [string, string, string]
        }));
      }
      
      steps.push({ type, question: finalQ });
    });

    // 3. Global questions at the very end
    if (globalQuestions.length > 0) {
      steps.push({ type: "global", questions: globalQuestions });
    }

    return steps;
  };

  const handleLoginJury = async (name: string) => {
    if (!name || !curSessId || !curSess) return;
    setCj(name);
    const { data } = await supabase
      .from("answers")
      .select("data")
      .eq("session_id", curSessId)
      .eq("juror_name", name)
      .maybeSingle();
    const answers = data?.data || {};
    setJa(answers);
    const jl = jurors.includes(name) ? jurors : [...jurors, name];
    const steps = buildSteps(curSess, name, jl);
    let firstIncomplete = 0;
    for (let i = 0; i < steps.length; i++) {
      if (!isStepDone(steps[i], answers)) {
        firstIncomplete = i;
        break;
      }
      if (i === steps.length - 1) firstIncomplete = i;
    }
    setCs(firstIncomplete);
    setScreen("form");
  };

  const handleSetJa = async (newJa: JurorAnswers) => {
    setJa(newJa);
    if (!cj || !curSessId) return;
    setSaveStatus("saving");
    const { error } = await supabase.from("answers").upsert({
      session_id: curSessId,
      juror_name: cj,
      data: newJa,
      updated_at: new Date().toISOString(),
    }, { onConflict: "session_id,juror_name" });
    if (error) {
      console.warn("Upsert échoué, mise en file d'attente locale:", error.message);
      queuePending(curSessId, cj, newJa);
      setPendingCount(countPending());
      setSaveStatus("pending");
      return;
    }
    clearPending(curSessId, cj);
    setPendingCount(countPending());
    setSaveStatus("saved");
    if (!jurors.includes(cj)) {
      const newJurors = [...jurors, cj];
      setJurors(newJurors);
      await supabase
        .from("sessions")
        .update({ juror_count: newJurors.length })
        .eq("id", curSessId);
      setSessions(sessions.map(s =>
        s.id === curSessId ? { ...s, jurorCount: newJurors.length } : s
      ));
    }
  };

  // Flush de la file d'attente hors-ligne dès qu'on est en ligne (montage + bascule online).
  const flushPending = async () => {
    const entries = listPending();
    if (entries.length === 0) { setPendingCount(0); return; }
    let ok = 0;
    for (const e of entries) {
      const { error } = await supabase.from("answers").upsert({
        session_id: e.sessionId,
        juror_name: e.jurorName,
        data: e.data,
        updated_at: new Date(e.ts).toISOString(),
      }, { onConflict: "session_id,juror_name" });
      if (!error) { clearPending(e.sessionId, e.jurorName); ok++; }
    }
    setPendingCount(countPending());
    if (ok > 0 && saveStatus !== "saving") setSaveStatus("saved");
  };

  useEffect(() => {
    setPendingCount(countPending());
  }, []);

  useEffect(() => {
    if (online) void flushPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // Masque le statut "saved" après 1,5s ; "error" reste affiché (l'utilisateur doit voir).
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = setTimeout(() => setSaveStatus("idle"), 1500);
    return () => clearTimeout(t);
  }, [saveStatus]);

  // Indique si l'étape courante est complète (gate Suivant)
  const isStepComplete = (stepIdx: number): boolean => {
    if (!curSess) return true;
    const steps = buildSteps(curSess, cj);
    const s = steps[stepIdx];
    if (!s) return true;
    if (s.type === "product") {
      const pa = ja[s.product.code] || {};
      // "Non évalué" (null) vaut réponse pour les échelles.
      return s.questions.every(q => q.type === "scale" || (pa[q.id] !== undefined && pa[q.id] !== "" && pa[q.id] !== null));
    }
    if (s.type === "ranking") return Array.isArray(ja["_rank"]?.[s.question.id]);
    if (s.type === "discrim") {
      const v = ja["_discrim"]?.[s.question.id];
      if (s.question.type === "a-non-a") {
        const codes: string[] = s.question.codes || [];
        if (!v || typeof v !== "object" || Array.isArray(v)) return false;
        const rec = v as unknown as Record<string, string>;
        return codes.length > 0 && codes.every(c => rec[c] != null);
      }
      if (s.question.type === "seuil-bet") {
        const levels = s.question.betLevels || [];
        if (!v || typeof v !== "object" || Array.isArray(v)) return false;
        const rec = v as unknown as Record<string, string>;
        return levels.length > 0 && levels.every((_: BetLevel, i: number) => rec[String(i)] != null && rec[String(i)] !== "");
      }
      return v != null && v !== "";
    }
    if (s.type === "global") {
      const ga = ja["_global"] || {};
      return s.questions.every(q => q.type === "scale" || (ga[q.id] !== undefined && ga[q.id] !== "" && ga[q.id] !== null));
    }
    return true;
  };

  const handleAnSessChange = async (id: string) => {
    setAnSessId(id);
    const cfg = await loadSessionConfig(id);
    setAnCfg(cfg);
    const { data } = await supabase
      .from("answers")
      .select("juror_name, data")
      .eq("session_id", id);
    const ans: Record<string, JurorAnswers> = {};
    if (data) data.forEach((r: { juror_name: string; data: JurorAnswers }) => { ans[r.juror_name] = r.data; });
    setAllAnswers(ans);
  };

  const saveSession = async (id: string, cfg: SessionConfig, meta: Partial<SessionListItem>) => {
    const { error } = await supabase.from("sessions").upsert({
      id,
      name: meta.name ?? cfg.name,
      date: meta.date ?? cfg.date,
      active: meta.active ?? false,
      juror_count: meta.jurorCount ?? 0,
      config: cfg,
    });
    if (error) {
      console.error("Erreur lors de l'enregistrement de la séance:", error);
      return { success: false, error };
    }
    return { success: true };
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) console.error("Erreur lors de la suppression:", error);
  };

  const listJurorsForSession = async (sessionId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from("answers")
      .select("juror_name")
      .eq("session_id", sessionId);
    if (error || !data) return [];
    return data.map((r: { juror_name: string }) => r.juror_name);
  };

  const deleteJury = async (sessionId: string, name: string) => {
    if (!sessionId) return { success: false };
    const { error } = await supabase
      .from("answers")
      .delete()
      .eq("session_id", sessionId)
      .eq("juror_name", name);
    if (error) {
      console.error("Erreur lors de la suppression du jury:", error);
      return { success: false };
    }
    if (sessionId === curSessId) {
      const newJurors = jurors.filter(j => j !== name);
      setJurors(newJurors);
      if (cj === name) { setCj(""); setJa({}); }
    }
    const remaining = await listJurorsForSession(sessionId);
    await supabase
      .from("sessions")
      .update({ juror_count: remaining.length })
      .eq("id", sessionId);
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, jurorCount: remaining.length } : s
    ));
    // Remove from in-memory allAnswers if loaded
    setAllAnswers(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    return { success: true };
  };

  const toggleActive = async (id: string) => {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    const newActive = !s.active;
    await supabase.from("sessions").update({ active: newActive }).eq("id", id);
    setSessions(sessions.map(x => x.id === id ? { ...x, active: newActive } : x));
  };

  const csvData = useMemo<CSVRow[]>(() => {
    if (!anCfg || !allAnswers) return [];
    const rows: CSVRow[] = [];
    const ppQ = anCfg.questions.filter(q => q.scope === "per-product");
    const rkQ = anCfg.questions.filter(q => q.type === "classement" || q.type === "seuil");
    const discQ = anCfg.questions.filter(q => ["triangulaire", "duo-trio", "a-non-a", "seuil-bet"].includes(q.type));
    const glQ = anCfg.questions.filter(q => q.scope === "global" && !["classement", "seuil", "seuil-bet", "triangulaire", "duo-trio", "a-non-a"].includes(q.type));

    // Build positional column keys for ranking/seuil questions
    const maxPositions = rkQ.length > 0
      ? Math.max(...rkQ.map(q => q.codes?.length || q.correctOrder?.length || anCfg.products?.length || 0))
      : 0;
    const posKeys = Array.from({ length: maxPositions }, (_, i) => `position ${i + 1}`);
    const corPosKeys = Array.from({ length: maxPositions }, (_, i) => `correct position ${i + 1}`);
    const emptyPos = [...posKeys, ...corPosKeys].reduce<Record<string, string>>((o, k) => { o[k] = ""; return o; }, {});

    Object.entries(allAnswers).forEach(([j, jans]: [string, JurorAnswers]) => {
      anCfg.products.forEach((p: Product) => {
        const pa = jans[p.code] || {};
        ppQ.forEach(q => {
          // Only include if the question applies to this product
          if (q.codes && q.codes.length > 0 && !q.codes.includes(p.code)) return;

          if (q.type === "radar") {
            // Explose chaque axe en ligne "scale" pour compat AnalyseProfil
            const answer = pa[q.id];
            if (answer && typeof answer === "object" && !Array.isArray(answer)) {
              (q.radarGroups || []).forEach(g => {
                (g.axes || []).forEach(ax => {
                  const axAns = (answer as Record<string, unknown>)[ax.label];
                  const main = (typeof axAns === "object" && axAns !== null)
                    ? (axAns as { _?: number })._
                    : axAns;
                  rows.push({
                    jury: j, produit: p.code, question: ax.label, type: "scale",
                    valeur: typeof main === "number" ? String(main) : "",
                    correct: "", ...emptyPos,
                  });
                });
              });
            }
            return;
          }
          rows.push({ jury: j, produit: p.code, question: q.label, type: q.type, valeur: formatVal(pa[q.id], q.type), correct: q.correctAnswer || "", ...emptyPos });
        });
      });
      const ra = (jans["_rank"] || {}) as Record<string, string[] | undefined>;
      rkQ.forEach(q => {
        const ranked: string[] = Array.isArray(ra[q.id]) ? ra[q.id]! : [];
        const correctOrder: string[] = q.correctOrder || [];
        const posCols = posKeys.reduce<Record<string, string>>((o, key, idx) => { o[key] = ranked[idx] || ""; return o; }, {});
        const corPosCols = corPosKeys.reduce<Record<string, string>>((o, key, idx) => { o[key] = correctOrder[idx] || ""; return o; }, {});
        rows.push({ jury: j, produit: "_classement", question: q.label, type: q.type, valeur: ranked.join(">"), correct: correctOrder.join(">"), ...posCols, ...corPosCols });
      });
      const da = jans["_discrim"] || {};
      discQ.forEach(q => {
        const val = da[q.id];
        const valStr = typeof val === "object" && val !== null ? JSON.stringify(val) : String(val ?? "");
        rows.push({ jury: j, produit: "_test", question: q.label, type: q.type, valeur: valStr, correct: q.correctAnswer || "", ...emptyPos });
      });
      const ga = jans["_global"] || {};
      glQ.forEach(q => rows.push({ jury: j, produit: "_global", question: q.label, type: q.type, valeur: formatVal(ga[q.id], q.type), correct: "", ...emptyPos }));
    });
    return rows;
  }, [anCfg, allAnswers]);

  return {
    mode, setMode,
    screen, setScreen,
    sessions, saveSessions,
    loading, online,
    loadSessionConfig,
    curSessId, curSess,
    jurors, cj, ja, cs, setCs,
    handleSelectSession, handleLoginJury, handleSetJa,
    editCfg, setEditCfg,
    editSessId, setEditSessId,
    curEditTab, setCurEditTab,
    anSessId, setAnSessId,
    anCfg, csvData, curAnT, setCurAnT,
    handleAnSessChange,
    buildSteps,
    saveSession,
    deleteSession,
    deleteJury,
    listJurorsForSession,
    toggleActive,
    loadSessions,
    allAnswers,
    saveStatus,
    pendingCount,
    flushPending,
    isStepComplete,
  };
};
