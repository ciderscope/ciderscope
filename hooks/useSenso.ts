"use client";
import { useState, useEffect, useMemo } from "react";
import { SessionListItem, SessionConfig } from "../types";
import { hsh, wlm, formatVal } from "../lib/utils";
import { supabase } from "../lib/supabase";

export const useSenso = () => {
  const [mode, setMode] = useState<"participant" | "admin" | "analyse">("participant");
  const [screen, setScreen] = useState<"landing" | "jury" | "form" | "done" | "edit">("landing");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [curSessId, setCurSessId] = useState<string | null>(null);
  const [curSess, setCurSess] = useState<SessionConfig | null>(null);
  const [jurors, setJurors] = useState<string[]>([]);
  const [cj, setCj] = useState<string>("");
  const [ja, setJa] = useState<any>({});
  const [cs, setCs] = useState<number>(0);
  const [editCfg, setEditCfg] = useState<SessionConfig | null>(null);
  const [editSessId, setEditSessId] = useState<string | null>(null);
  const [curEditTab, setCurEditTab] = useState<string>("session");
  const [anSessId, setAnSessId] = useState<string | null>(null);
  const [anCfg, setAnCfg] = useState<SessionConfig | null>(null);
  const [allAnswers, setAllAnswers] = useState<any>({});
  const [curAnT, setCurAnT] = useState<string>("profil");

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
      .select("id, name, date, active, juror_count")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Erreur lors du chargement des séances:", error);
      setOnline(false);
    } else if (data) {
      setOnline(true);
      setSessions(data.map((r: any) => ({
        id: r.id,
        name: r.name,
        date: r.date,
        active: r.active,
        jurorCount: r.juror_count,
      })));
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
    setJurors(data ? data.map((r: any) => r.juror_name) : []);
    setScreen("jury");
  };

  const isStepDone = (s: any, currentJa: any) => {
    if (s.type === "product") return currentJa[s.product.code] && s.questions.some((q: any) => currentJa[s.product.code][q.id] != null);
    if (s.type === "ranking") return currentJa["_rank"] && currentJa["_rank"][s.question.id] != null;
    if (s.type === "discrim") return currentJa["_discrim"] && currentJa["_discrim"][s.question.id] != null;
    if (s.type === "global") return currentJa["_global"] && s.questions.some((q: any) => currentJa["_global"][q.id] != null);
    return false;
  };

  const getOrderedProducts = (cfg: SessionConfig, name: string, jurorList: string[]) => {
    const ps = cfg.products;
    const m = cfg.presMode || "fixed";
    if (m === "fixed") return [...ps];
    const ji = jurorList.indexOf(name);
    const idx = ji >= 0 ? ji : jurorList.length;
    if (m === "latin") {
      const sq = wlm(ps.length);
      return sq[idx % sq.length].map((i: number) => ps[i]);
    }
    const a = [...ps];
    let sd = hsh((cfg.name || "") + name);
    for (let k = a.length - 1; k > 0; k--) {
      sd = ((sd * 1103515245 + 12345) & 0x7fffffff);
      [a[k], a[sd % (k + 1)]] = [a[sd % (k + 1)], a[k]];
    }
    return a;
  };

  const buildSteps = (cfg: SessionConfig, jurorName: string, jurorList?: string[]) => {
    if (!cfg) return [];
    const jl = jurorList || jurors;
    const st: any[] = [];
    const ppQ = cfg.questions.filter((q: any) => q.scope === "per-product");
    const rankQ = cfg.questions.filter((q: any) => q.type === "classement" || q.type === "seuil");
    const discQ = cfg.questions.filter((q: any) => ["triangulaire", "duo-trio", "a-non-a"].includes(q.type));
    const glQ = cfg.questions.filter((q: any) => q.scope === "global" && !["classement", "seuil", "triangulaire", "duo-trio", "a-non-a"].includes(q.type));
    const products = getOrderedProducts(cfg, jurorName, jl);
    if (ppQ.length) products.forEach(p => st.push({ type: "product", product: p, questions: ppQ }));
    rankQ.forEach(q => st.push({ type: "ranking", question: q }));
    discQ.forEach(q => st.push({ type: "discrim", question: q }));
    if (glQ.length) st.push({ type: "global", questions: glQ });
    return st;
  };

  const handleLoginJury = async (name: string) => {
    if (!name || !curSessId || !curSess) return;
    setCj(name);
    const { data } = await supabase
      .from("answers")
      .select("data")
      .eq("session_id", curSessId)
      .eq("juror_name", name)
      .single();
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

  const handleSetJa = async (newJa: any) => {
    setJa(newJa);
    if (!cj || !curSessId) return;
    // Upsert answers
    await supabase.from("answers").upsert({
      session_id: curSessId,
      juror_name: cj,
      data: newJa,
      updated_at: new Date().toISOString(),
    });
    // Update juror list if new
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

  const handleAnSessChange = async (id: string) => {
    setAnSessId(id);
    const cfg = await loadSessionConfig(id);
    setAnCfg(cfg);
    const { data } = await supabase
      .from("answers")
      .select("juror_name, data")
      .eq("session_id", id);
    const ans: any = {};
    if (data) data.forEach((r: any) => { ans[r.juror_name] = r.data; });
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

  const toggleActive = async (id: string) => {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    const newActive = !s.active;
    await supabase.from("sessions").update({ active: newActive }).eq("id", id);
    setSessions(sessions.map(x => x.id === id ? { ...x, active: newActive } : x));
  };

  const csvData = useMemo(() => {
    if (!anCfg || !allAnswers) return [];
    const rows: any[] = [];
    const ppQ = anCfg.questions.filter((q: any) => q.scope === "per-product");
    const rkQ = anCfg.questions.filter((q: any) => q.type === "classement" || q.type === "seuil");
    const discQ = anCfg.questions.filter((q: any) => ["triangulaire", "duo-trio", "a-non-a"].includes(q.type));
    const glQ = anCfg.questions.filter((q: any) => q.scope === "global" && !["classement", "seuil", "triangulaire", "duo-trio", "a-non-a"].includes(q.type));

    Object.entries(allAnswers).forEach(([j, jans]: [string, any]) => {
      anCfg.products.forEach((p: any) => {
        const pa = jans[p.code] || {};
        ppQ.forEach((q: any) => rows.push({ jury: j, produit: p.code, question: q.label, type: q.type, valeur: formatVal(pa[q.id], q.type), correct: q.correctAnswer || "" }));
      });
      const ra = jans["_rank"] || {};
      rkQ.forEach((q: any) => rows.push({ jury: j, produit: "_classement", question: q.label, type: q.type, valeur: Array.isArray(ra[q.id]) ? ra[q.id].join(">") : (ra[q.id] || ""), correct: (q.correctOrder || []).join(">") }));
      const da = jans["_discrim"] || {};
      discQ.forEach((q: any) => {
        const val = da[q.id];
        const valStr = typeof val === "object" && val !== null ? JSON.stringify(val) : (val || "");
        rows.push({ jury: j, produit: "_test", question: q.label, type: q.type, valeur: valStr, correct: q.correctAnswer || "" });
      });
      const ga = jans["_global"] || {};
      glQ.forEach((q: any) => rows.push({ jury: j, produit: "_global", question: q.label, type: q.type, valeur: formatVal(ga[q.id], q.type), correct: "" }));
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
    toggleActive,
    loadSessions,
    allAnswers,
  };
};
