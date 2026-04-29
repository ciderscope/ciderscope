"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SessionListItem, SessionConfig, Question, JurorAnswers, BetLevel, Product, SessionStep, CSVRow, AllAnswers, AppMode, AppScreen, SaveStatus, Poste, PosteDay } from "../types";
import { hsh, wlm, formatVal } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { queuePending, clearPending, listPending, countPending } from "../lib/offlineQueue";

// Cache mémoire des configs de séance (invalidé sur saveSession/deleteSession).
const _configCache = new Map<string, SessionConfig>();

export const useSenso = () => {
  const [mode, setMode] = useState<AppMode>("participant");
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [curSessId, setCurSessId] = useState<string | null>(null);
  const [curSess, setCurSess] = useState<SessionConfig | null>(null);
  const [jurors, setJurors] = useState<string[]>([]);
  // Map des postes pris pour la séance courante : "mardi-3" -> juryName.
  const [takenPostes, setTakenPostes] = useState<Record<string, string>>({});
  const [cj, setCj] = useState<string>("");
  const [poste, setPoste] = useState<Poste | null>(null);
  const [ja, setJa] = useState<JurorAnswers>({});
  const [cs, setCs] = useState<number>(0);
  // Suivi des étapes déjà validées par le jury : il faudra une autorisation pour y revenir.
  const [validatedSteps, setValidatedSteps] = useState<Set<number>>(new Set());
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
    const cached = _configCache.get(id);
    if (cached) return cached;
    const { data, error } = await supabase
      .from("sessions")
      .select("config")
      .eq("id", id)
      .single();
    if (error || !data) {
      console.error("Erreur lors du chargement de la config:", error);
      return null;
    }
    const cfg = data.config as SessionConfig;
    _configCache.set(id, cfg);
    return cfg;
  };

  const posteKey = (p: Poste) => `${p.day}-${p.num}`;
  const readPoste = (jaData: JurorAnswers | null | undefined): Poste | null => {
    const meta = jaData?.["_poste"];
    if (!meta || typeof meta !== "object") return null;
    const day = (meta as Record<string, unknown>).day;
    const num = (meta as Record<string, unknown>).num;
    if ((day === "mardi" || day === "jeudi") && typeof num === "number" && num >= 1 && num <= 10) {
      return { day, num };
    }
    return null;
  };
  const posteToIndex = (p: Poste | null): number | null => {
    if (!p) return null;
    return (p.day === "jeudi" ? 10 : 0) + (p.num - 1);
  };

  const handleSelectSession = async (id: string) => {
    const cfg = await loadSessionConfig(id);
    if (!cfg) return;
    setCurSessId(id);
    setCurSess(cfg);
    const { data, error } = await supabase
      .from("answers")
      .select("juror_name, data")
      .eq("session_id", id);
    if (error) console.error("Erreur lors du chargement des jurys:", error);
    const rows = (data || []) as Array<{ juror_name: string; data: JurorAnswers | null }>;
    setJurors(rows.map(r => r.juror_name));
    const taken: Record<string, string> = {};
    rows.forEach(r => {
      const p = readPoste(r.data || undefined);
      if (p) taken[posteKey(p)] = r.juror_name;
    });
    setTakenPostes(taken);
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

  const getOrderedItems = <T,>(items: T[], mode: string, name: string, jurorList: string[], sessionName: string, posteIdx?: number | null): T[] => {
    if (!items || items.length === 0) return [];
    if (mode === "fixed") return [...items];

    // Le numéro de poste, s'il est renseigné, prend le pas sur l'index alphabétique :
    // l'ordre de service de la feuille papier doit être respecté.
    const idx = (posteIdx != null) ? posteIdx : getJurorIndex(name, jurorList);

    if (mode === "latin") {
      const sq = wlm(items.length);
      return sq[idx % sq.length].map((i: number) => items[i]);
    }

    // Random mode: use a stable seed based on session + poste|name
    const a = [...items];
    const seedKey = (posteIdx != null) ? `poste${posteIdx}` : name;
    let sd = hsh((sessionName || "") + seedKey);
    for (let k = a.length - 1; k > 0; k--) {
      sd = ((sd * 1103515245 + 12345) & 0x7fffffff);
      [a[k], a[sd % (k + 1)]] = [a[sd % (k + 1)], a[k]];
    }
    return a;
  };

  const buildSteps = useCallback((cfg: SessionConfig, jurorName: string, jurorList?: string[], posteOverride?: Poste | null) => {
    if (!cfg) return [];
    const jl = jurorList || jurors;
    const mode = cfg.presMode || "fixed";
    const effectivePoste = (posteOverride !== undefined) ? posteOverride : poste;
    const posteIdx = posteToIndex(effectivePoste);

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
      const orderedCodes = getOrderedItems(activeCodes, mode, jurorName, jl, cfg.name, posteIdx);
      
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
    const orderedSeries = getOrderedItems(seriesQuestions, mode, jurorName, jl, cfg.name + "series", posteIdx);

    orderedSeries.forEach(q => {
      const type = (q.type === "classement" || q.type === "seuil") ? "ranking" : "discrim";

      let finalCodes = [...(q.codes || [])];
      if (finalCodes.length === 0 && (q.type === "classement" || q.type === "seuil")) {
        finalCodes = cfg.products.map(p => p.code);
      }

      // Randomize the codes for this juror
      const randomizedCodes = getOrderedItems(finalCodes, mode, jurorName, jl, cfg.name + q.id, posteIdx);

      const finalQ = { ...q, codes: randomizedCodes };

      // Deep randomization for complex types
      if (q.type === "seuil-bet" && q.betLevels) {
        finalQ.betLevels = q.betLevels.map((lv: BetLevel, lIdx: number) => ({
          ...lv,
          codes: getOrderedItems([...lv.codes], mode, jurorName, jl, cfg.name + q.id + "l" + lIdx, posteIdx) as [string, string, string]
        }));
      }

      steps.push({ type, question: finalQ });
    });

    // 3. Global questions at the very end
    if (globalQuestions.length > 0) {
      steps.push({ type: "global", questions: globalQuestions });
    }

    return steps;
    // getOrderedItems est une fonction pure des arguments — sa redéfinition à chaque
    // render ne change pas le résultat de buildSteps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jurors, poste]);

  const handleLoginJury = async (name: string) => {
    if (!name || !curSessId || !curSess) return;
    setCj(name);
    const { data } = await supabase
      .from("answers")
      .select("data")
      .eq("session_id", curSessId)
      .eq("juror_name", name)
      .maybeSingle();
    const answers = (data?.data || {}) as JurorAnswers;
    setJa(answers);
    setValidatedSteps(new Set());

    // Si le jury a déjà un poste enregistré (reprise), on saute l'écran de sélection.
    const existing = readPoste(answers);
    if (existing) {
      setPoste(existing);
      const jl = jurors.includes(name) ? jurors : [...jurors, name];
      const steps = buildSteps(curSess, name, jl, existing);
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
      return;
    }

    setPoste(null);
    setScreen("poste");
  };

  const handleSelectPoste = async (day: PosteDay, num: number) => {
    if (!curSess || !curSessId || !cj) return;
    const p: Poste = { day, num };
    const key = posteKey(p);
    if (takenPostes[key] && takenPostes[key] !== cj) return; // déjà pris par un autre
    setPoste(p);
    setTakenPostes(prev => ({ ...prev, [key]: cj }));
    // Persister le poste dans les réponses du jury
    const next: JurorAnswers = { ...ja, _poste: { day, num } as Record<string, string | number> };
    setJa(next);
    if (curSessId && cj) {
      await supabase.from("answers").upsert({
        session_id: curSessId,
        juror_name: cj,
        data: next,
        updated_at: new Date().toISOString(),
      }, { onConflict: "session_id,juror_name" });
    }
    setCs(0);
    setValidatedSteps(new Set());
    setScreen("form");
  };

  const validateStep = (idx: number) => {
    setValidatedSteps(prev => {
      if (prev.has(idx)) return prev;
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  // Upsert différé : on agrège les saisies rapides (sliders, drag) en une seule requête.
  const _saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const _pendingJaRef = useRef<JurorAnswers | null>(null);

  const flushSave = useCallback(async () => {
    if (_saveTimerRef.current) {
      clearTimeout(_saveTimerRef.current);
      _saveTimerRef.current = null;
    }
    const newJa = _pendingJaRef.current;
    _pendingJaRef.current = null;
    if (!newJa || !cj || !curSessId) return;
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
      setSessions(prev => prev.map(s =>
        s.id === curSessId ? { ...s, jurorCount: newJurors.length } : s
      ));
    }
  }, [cj, curSessId, jurors]);

  const handleSetJa = (newJa: JurorAnswers) => {
    setJa(newJa);
    if (!cj || !curSessId) return;
    _pendingJaRef.current = newJa;
    if (_saveTimerRef.current) clearTimeout(_saveTimerRef.current);
    _saveTimerRef.current = setTimeout(() => { void flushSave(); }, 400);
  };

  // Flush de la file d'attente hors-ligne dès qu'on est en ligne (montage + bascule online).
  const flushPending = async () => {
    const entries = listPending();
    if (entries.length === 0) { setPendingCount(0); return; }
    const results = await Promise.all(entries.map(e =>
      supabase.from("answers").upsert({
        session_id: e.sessionId,
        juror_name: e.jurorName,
        data: e.data,
        updated_at: new Date(e.ts).toISOString(),
      }, { onConflict: "session_id,juror_name" }).then(({ error }) => ({ e, error }))
    ));
    let ok = 0;
    for (const { e, error } of results) {
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

  // Flush la sauvegarde différée à chaque changement d'étape (sécurité supplémentaire).
  useEffect(() => {
    if (_pendingJaRef.current) void flushSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs]);

  // Flush au démontage pour éviter les pertes lors d'une navigation.
  useEffect(() => {
    return () => { if (_pendingJaRef.current) void flushSave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Masque le statut "saved" après 1,5s ; "error" reste affiché (l'utilisateur doit voir).
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = setTimeout(() => setSaveStatus("idle"), 1500);
    return () => clearTimeout(t);
  }, [saveStatus]);

  // Steps mémoïsés pour le jury courant — recalculés uniquement quand la config / nom / poste / liste change.
  const currentSteps = useMemo<SessionStep[]>(() => {
    if (!curSess || !cj) return [];
    return buildSteps(curSess, cj);
  }, [curSess, cj, buildSteps]);

  // Vérifie la complétion d'un step donné contre un état de réponses.
  const checkStepDone = (s: SessionStep, jaState: JurorAnswers): boolean => {
    if (!s) return true;
    if (s.type === "product") {
      const pa = jaState[s.product.code] || {};
      return s.questions.every(q => q.type === "scale" || (pa[q.id] !== undefined && pa[q.id] !== "" && pa[q.id] !== null));
    }
    if (s.type === "ranking") return Array.isArray(jaState["_rank"]?.[s.question.id]);
    if (s.type === "discrim") {
      const v = jaState["_discrim"]?.[s.question.id];
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
      const ga = jaState["_global"] || {};
      return s.questions.every(q => q.type === "scale" || (ga[q.id] !== undefined && ga[q.id] !== "" && ga[q.id] !== null));
    }
    return true;
  };

  // Tableau de complétion par étape — calculé une seule fois par changement de ja/steps.
  const completion = useMemo<boolean[]>(
    () => currentSteps.map(s => checkStepDone(s, ja)),
    [currentSteps, ja]
  );

  // Indique si l'étape courante est complète (gate Suivant)
  const isStepComplete = (stepIdx: number): boolean => completion[stepIdx] ?? true;

  const handleAnSessChange = async (id: string) => {
    setAnSessId(id);
    const cfg = await loadSessionConfig(id);
    setAnCfg(cfg);
    const { data } = await supabase
      .from("answers")
      .select("juror_name, data")
      .eq("session_id", id);
    const ans: Record<string, JurorAnswers> = {};
    if (data) data.forEach((r: { juror_name: string; data: JurorAnswers | null }) => { ans[r.juror_name] = r.data || {}; });
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
    _configCache.set(id, cfg);
    return { success: true };
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) console.error("Erreur lors de la suppression:", error);
    _configCache.delete(id);
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

    // Build positional column keys for ranking/seuil questions (calculé une fois).
    const maxPositions = rkQ.length > 0
      ? Math.max(...rkQ.map(q => q.codes?.length || q.correctOrder?.length || anCfg.products?.length || 0))
      : 0;
    const posKeys = Array.from({ length: maxPositions }, (_, i) => `position ${i + 1}`);
    const corPosKeys = Array.from({ length: maxPositions }, (_, i) => `correct position ${i + 1}`);
    const emptyPos: Record<string, string> = {};
    for (const k of posKeys) emptyPos[k] = "";
    for (const k of corPosKeys) emptyPos[k] = "";

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
        const row: CSVRow = { jury: j, produit: "_classement", question: q.label, type: q.type, valeur: ranked.join(">"), correct: correctOrder.join(">"), ...emptyPos };
        for (let idx = 0; idx < posKeys.length; idx++) row[posKeys[idx]] = ranked[idx] || "";
        for (let idx = 0; idx < corPosKeys.length; idx++) row[corPosKeys[idx]] = correctOrder[idx] || "";
        rows.push(row);
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
    poste, takenPostes, handleSelectPoste,
    validatedSteps, validateStep,
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
    currentSteps,
    completion,
    flushSave,
  };
};
