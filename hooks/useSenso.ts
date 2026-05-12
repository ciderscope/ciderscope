"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SessionListItem, SessionConfig, Question, JurorAnswers, BetLevel, SessionStep, AllAnswers, AppMode, AppScreen, SaveStatus, Poste, PosteDay } from "../types";
import { hsh, wlm } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { queuePending, clearPending, listPending, countPending } from "../lib/offlineQueue";
import { asRecord, isStepDone } from "../lib/sessionSteps";

// Cache mémoire des configs de séance avec TTL : invalidé sur saveSession/deleteSession,
// et automatiquement au-delà de CONFIG_CACHE_TTL_MS pour limiter les divergences avec
// d'autres clients qui auraient modifié la séance entre-temps.
type ConfigCacheEntry = { cfg: SessionConfig; ts: number };
const _configCache = new Map<string, ConfigCacheEntry>();
const CONFIG_CACHE_TTL_MS = 60_000;

const APP_MODES = ["home", "participant", "admin"] as const satisfies readonly AppMode[];
const APP_SCREENS = ["landing", "jury", "poste", "order", "form", "done", "summary", "edit"] as const satisfies readonly AppScreen[];
const ADMIN_SECTIONS = ["seances", "analyse"] as const;

const isStoredChoice = <T extends string>(value: string | null, choices: readonly T[]): value is T => {
  return !!value && (choices as readonly string[]).includes(value);
};

const parseStoredStep = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const logDataError = (message: string, error: unknown) => {
  console.error(message, error);
};

export const useSenso = () => {
  const [mode, setMode] = useState<AppMode>("home");
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restored, setRestored] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
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
  const [adminSection, setAdminSection] = useState<"seances" | "analyse">("seances");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Snapshot d'état lu par les handlers stables (useCallback avec deps vides).
  // Mis à jour à chaque render avant l'effect — les callbacks lisent toujours
  // la valeur fraîche via stateRef.current sans avoir à se rebuilder.
  type SensoStateSnapshot = {
    mode: AppMode; screen: AppScreen; sessions: SessionListItem[];
    curSessId: string | null; curSess: SessionConfig | null;
    jurors: string[]; takenPostes: Record<string, string>;
    cj: string; poste: Poste | null; ja: JurorAnswers; cs: number;
    validatedSteps: Set<number>;
    editCfg: SessionConfig | null; editSessId: string | null; curEditTab: string;
    anSessId: string | null; anCfg: SessionConfig | null; allAnswers: AllAnswers;
    curAnT: string; adminSection: "seances" | "analyse";
    saveStatus: SaveStatus; pendingCount: number;
  };
  const stateRef = useRef<SensoStateSnapshot>({
    mode, screen, sessions, curSessId, curSess, jurors, takenPostes,
    cj, poste, ja, cs, validatedSteps, editCfg, editSessId, curEditTab,
    anSessId, anCfg, allAnswers, curAnT, adminSection, saveStatus, pendingCount,
  });
  stateRef.current = {
    mode, screen, sessions, curSessId, curSess, jurors, takenPostes,
    cj, poste, ja, cs, validatedSteps, editCfg, editSessId, curEditTab,
    anSessId, anCfg, allAnswers, curAnT, adminSection, saveStatus, pendingCount,
  };

  // Persistence unifiée : un seul effect debouncé écrit toutes les clés en bloc.
  // Évite la cascade de 11 setItem synchrones à chaque transition d'étape, et coalesce
  // les rafales de mises à jour (changement d'onglet + de session + de jury, etc.).
  const _persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Snapshot des dernières valeurs écrites pour ne pas réécrire des clés inchangées.
  const _persistSnapshotRef = useRef<Record<string, string | null>>({});

  useEffect(() => {
    if (!restored) return;
    if (_persistTimerRef.current) clearTimeout(_persistTimerRef.current);
    _persistTimerRef.current = setTimeout(() => {
      _persistTimerRef.current = null;
      const next: Record<string, string | null> = {
        senso_mode: mode,
        senso_screen: screen,
        senso_admin_section: adminSection,
        senso_cj: cj,
        senso_cs: cs.toString(),
        senso_curEditTab: curEditTab,
        senso_curAnT: curAnT,
        senso_curSessId: curSessId,
        senso_editSessId: editSessId,
        senso_anSessId: anSessId,
      };
      const prev = _persistSnapshotRef.current;
      try {
        for (const key in next) {
          const v = next[key];
          if (prev[key] === v) continue;
          if (v == null || v === "") {
            // Valeurs nulles/vides : retirées plutôt que persistées en chaîne vide.
            if (key === "senso_cj" || key === "senso_cs") {
              localStorage.setItem(key, v ?? "");
            } else {
              localStorage.removeItem(key);
            }
          } else {
            localStorage.setItem(key, v);
          }
        }
        _persistSnapshotRef.current = next;
      } catch (err) {
        console.warn("Persistance localStorage échouée:", err);
      }
    }, 200);
    return () => {
      if (_persistTimerRef.current) {
        clearTimeout(_persistTimerRef.current);
        _persistTimerRef.current = null;
      }
    };
  }, [restored, mode, screen, adminSection, cj, cs, curEditTab, curAnT, curSessId, editSessId, anSessId]);

  // Online/offline detection
  useEffect(() => {
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load session list and restore state on mount
  useEffect(() => {
    const restoreApp = async () => {
      setLoading(true);
      await loadSessions(true);

      const savedMode = localStorage.getItem("senso_mode");
      const savedScreen = localStorage.getItem("senso_screen");
      const savedSessId = localStorage.getItem("senso_curSessId");
      const savedCj = localStorage.getItem("senso_cj");
      const savedCs = localStorage.getItem("senso_cs");
      const savedEditSessId = localStorage.getItem("senso_editSessId");
      const savedEditTab = localStorage.getItem("senso_curEditTab");
      const savedAnSessId = localStorage.getItem("senso_anSessId");
      const savedAnT = localStorage.getItem("senso_curAnT");
      const savedAdminSection = localStorage.getItem("senso_admin_section");

      // Auth admin locale de session.
      if (sessionStorage.getItem("admin_auth") === "1") setAdminAuth(true);

      if (isStoredChoice(savedMode, APP_MODES)) setMode(savedMode);
      if (isStoredChoice(savedScreen, APP_SCREENS)) setScreen(savedScreen);
      if (isStoredChoice(savedAdminSection, ADMIN_SECTIONS)) setAdminSection(savedAdminSection);

      const promises: Promise<unknown>[] = [];

      if (savedEditSessId) {
        setEditSessId(savedEditSessId);
        promises.push(loadSessionConfig(savedEditSessId).then(cfg => {
          if (cfg) setEditCfg(cfg);
        }));
      }
      if (savedEditTab) setCurEditTab(savedEditTab);
      if (savedAnT) setCurAnT(savedAnT);
      const savedStep = parseStoredStep(savedCs);
      if (savedStep !== null) setCs(savedStep);

      if (savedSessId) {
        setCurSessId(savedSessId);
        promises.push(loadSessionData(savedSessId).then(async () => {
          if (savedCj) {
            setCj(savedCj);
            await reloadJuryData(savedSessId, savedCj);
          }
        }));
      }

      if (savedAnSessId) {
        promises.push(handleAnSessChange(savedAnSessId));
      }
      
      await Promise.all(promises);
      
      setRestored(true);
      setLoading(false);
    };

    void restoreApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadJuryData = useCallback(async (sessionId: string, jurorName: string) => {
    const { data } = await supabase
      .from("answers")
      .select("data")
      .eq("session_id", sessionId)
      .eq("juror_name", jurorName)
      .maybeSingle();
    const answers = (data?.data || {}) as JurorAnswers;
    setJa(answers);
    const p = readPoste(answers);
    if (p) setPoste(p);
  }, []);

  const loadSessions = useCallback(async (keepLoading?: boolean) => {
    if (!keepLoading) setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, name, date, active, juror_count, config, results_visible")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Erreur lors du chargement des séances:", error);
      console.error("Détails sérialisés:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
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
        results_visible: boolean | null;
      };
      const next: SessionListItem[] = (data as SessionRow[]).map(r => {
        const cfg = r.config;
        return {
          id: r.id,
          name: r.name,
          date: r.date,
          active: r.active,
          jurorCount: r.juror_count,
          productCount: cfg?.products?.length || 0,
          questionCount: cfg?.questions?.length || 0,
          resultsVisible: !!r.results_visible,
        };
      });
      // En polling, évite de remplacer la liste (et de re-render tout l'arbre)
      // quand rien n'a changé. Comparaison structurelle peu profonde sur les
      // champs affichés.
      setSessions(prev => {
        if (prev.length === next.length) {
          let same = true;
          for (let i = 0; i < prev.length; i++) {
            const a = prev[i], b = next[i];
            if (a.id !== b.id || a.name !== b.name || a.date !== b.date ||
                a.active !== b.active || a.jurorCount !== b.jurorCount ||
                a.productCount !== b.productCount || a.questionCount !== b.questionCount ||
                a.resultsVisible !== b.resultsVisible) {
              same = false; break;
            }
          }
          if (same) return prev;
        }
        return next;
      });
    }
    if (!keepLoading) setLoading(false);
  }, []);

  // Lecture du cache : on accepte une entrée fraîche (< TTL) sauf si `force` est demandé.
  // Les entrées expirées sont supprimées pour ne pas grossir la map indéfiniment.
  const loadSessionConfig = useCallback(async (
    id: string,
    opts?: { force?: boolean }
  ): Promise<SessionConfig | null> => {
    const cached = _configCache.get(id);
    const now = Date.now();
    if (!opts?.force && cached && (now - cached.ts) < CONFIG_CACHE_TTL_MS) {
      return cached.cfg;
    }
    if (cached && (now - cached.ts) >= CONFIG_CACHE_TTL_MS) {
      _configCache.delete(id);
    }
    const { data, error } = await supabase
      .from("sessions")
      .select("config")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("Erreur lors du chargement de la config:", error);
      console.error("Détails sérialisés config:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      return null;
    }
    if (!data) {
      console.warn(`Configuration introuvable pour la séance (id: ${id}). Ceci est normal si la séance a été supprimée.`);
      return null;
    }
    const cfg = data.config as SessionConfig;
    _configCache.set(id, { cfg, ts: now });
    return cfg;
  }, []);

  const posteKey = (p: Poste) => `${p.day}-${p.num}`;
  const readPoste = (jaData: JurorAnswers | null | undefined): Poste | null => {
    const meta = asRecord(jaData?.["_poste"]);
    const day = meta.day;
    const num = meta.num;
    if ((day === "mardi" || day === "jeudi") && typeof num === "number" && num >= 1 && num <= 10) {
      return { day, num };
    }
    return null;
  };
  const posteToIndex = (p: Poste | null): number | null => {
    if (!p) return null;
    return (p.day === "jeudi" ? 10 : 0) + (p.num - 1);
  };

  const loadSessionData = useCallback(async (id: string) => {
    const cfg = await loadSessionConfig(id);
    if (!cfg) return null;
    setCurSess(cfg);
    const { data, error } = await supabase
      .from("answers")
      .select("juror_name, data")
      .eq("session_id", id);
    if (error) {
      logDataError("Erreur lors du chargement des jurys:", error);
    }
    const rows = (data || []) as Array<{ juror_name: string; data: JurorAnswers | null }>;
    setJurors(rows.map(r => r.juror_name));
    const taken: Record<string, string> = {};
    rows.forEach(r => {
      const p = readPoste(r.data || undefined);
      if (p) taken[posteKey(p)] = r.juror_name;
    });
    setTakenPostes(taken);
    return cfg;
  }, [loadSessionConfig]);

  const handleSelectSession = useCallback(async (id: string) => {
    const cfg = await loadSessionData(id);
    if (!cfg) return;
    setCurSessId(id);
    setScreen("jury");
  }, [loadSessionData]);

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
    const jl = jurorList || stateRef.current.jurors;
    const mode = cfg.presMode || "fixed";
    const effectivePoste = (posteOverride !== undefined) ? posteOverride : stateRef.current.poste;
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
    // render ne change pas le résultat de buildSteps. La lecture des states courants
    // (jurors, poste) passe par stateRef pour garder une référence stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginJury = useCallback(async (name: string, opts?: { review?: boolean }) => {
    const { curSessId, curSess, jurors } = stateRef.current;
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

    // Si le jury a déjà finalisé sa séance, on l'envoie directement sur l'écran
    // "Terminé !" plutôt que sur le dernier échantillon. La relecture ("Revoir
    // mes réponses") force l'entrée dans le formulaire via opts.review.
    if (!opts?.review && answers["_finished"] === true) {
      const existing = readPoste(answers);
      if (existing) setPoste(existing);
      setScreen("done");
      return;
    }

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
  }, [buildSteps]);

  const handleSelectPoste = useCallback(async (day: PosteDay, num: number) => {
    const { curSess, curSessId, cj, ja, takenPostes } = stateRef.current;
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
      const { error } = await supabase.from("answers").upsert({
        session_id: curSessId,
        juror_name: cj,
        data: next,
        updated_at: new Date().toISOString(),
      }, { onConflict: "session_id,juror_name" });
      if (error) {
        logDataError("Erreur lors de l'enregistrement du poste:", error);
      }
    }
    setCs(0);
    setValidatedSteps(new Set());
    // L'écran "order" affiche l'ordre de service personnel avant le questionnaire.
    setScreen("order");
  }, []);

  const validateStep = useCallback((idx: number) => {
    setValidatedSteps(prev => {
      if (prev.has(idx)) return prev;
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  }, []);

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
    const { cj, curSessId, jurors } = stateRef.current;
    if (!newJa || !cj || !curSessId) return;
    setSaveStatus("saving");
    const { error } = await supabase.from("answers").upsert({
      session_id: curSessId,
      juror_name: cj,
      data: newJa,
      updated_at: new Date().toISOString(),
    }, { onConflict: "session_id,juror_name" });
    if (error) {
      console.warn("Upsert échoué, mise en file d'attente locale:", error);
      console.warn("Détails sérialisés upsert:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
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
      const { error: upError } = await supabase
        .from("sessions")
        .update({ juror_count: newJurors.length })
        .eq("id", curSessId);
      if (upError) {
        logDataError("Erreur lors de la mise à jour du compteur de jurys:", upError);
      }
      setSessions(prev => prev.map(s =>
        s.id === curSessId ? { ...s, jurorCount: newJurors.length } : s
      ));
    }
  }, []);

  // Accepte soit un objet `JurorAnswers` complet, soit un updater fonctionnel
  // (à la `useState`). Le mode fonctionnel résout une race courante : le
  // cleanup d'un useEffect (par ex. l'enregistrement du `_timing` du step)
  // s'exécute pendant le commit de démontage avec un `jaRef` figé sur l'état
  // du render précédent — il écrasait alors `_finished: true` posé juste
  // avant `setScreen("done")`. En lisant `stateRef.current.ja`, on récupère
  // toujours la version la plus récente.
  type JaUpdater = JurorAnswers | ((prev: JurorAnswers) => JurorAnswers);
  const handleSetJa = useCallback((updater: JaUpdater) => {
    const prev = stateRef.current.ja;
    const newJa = typeof updater === "function" ? (updater as (p: JurorAnswers) => JurorAnswers)(prev) : updater;
    setJa(newJa);
    const { cj, curSessId } = stateRef.current;
    if (!cj || !curSessId) return;
    _pendingJaRef.current = newJa;
    if (_saveTimerRef.current) clearTimeout(_saveTimerRef.current);
    _saveTimerRef.current = setTimeout(() => { void flushSave(); }, 400);
  }, [flushSave]);

  // Flush de la file d'attente hors-ligne dès qu'on est en ligne (montage + bascule online).
  const flushPending = useCallback(async () => {
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
    if (ok > 0 && stateRef.current.saveStatus !== "saving") setSaveStatus("saved");
  }, []);

  useEffect(() => {
    setPendingCount(countPending());
  }, []);

  useEffect(() => {
    if (online) void flushPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // Rafraîchissement périodique de la liste des séances tant qu'on regarde
  // le tableau (landing participant ou liste admin). Sans cela, le compteur
  // de jurys reste figé à la valeur lue au montage ; les arrivées d'autres
  // postes ne remontent jamais à l'écran. On étend aussi ce polling à l'écran
  // "Terminé !" (intervalle 5 s) pour que le bouton "Voir les résultats" se
  // débloque sans rechargement dès que l'animateur l'autorise. On évite de
  // tourner si l'onglet est masqué (visibilitychange) pour ne pas générer de
  // trafic inutile.
  useEffect(() => {
    if (!restored) return;
    if (screen !== "landing" && screen !== "done") return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void loadSessions(true);
    };
    const intervalMs = screen === "done" ? 5_000 : 10_000;
    const id = setInterval(tick, intervalMs);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [restored, screen, loadSessions]);

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
  // Pour les questions "scale" on exige une validation explicite : le jury
  // doit avoir tapé/glissé le pouce du curseur (drapeau `_touched` posé par
  // ScaleInput). Le format ancien (valeur brute number) est considéré comme
  // déjà validé pour la rétrocompatibilité.
  // Tableau de complétion par étape — calculé une seule fois par changement de ja/steps.
  const completion = useMemo<boolean[]>(
    () => currentSteps.map(s => isStepDone(s, ja)),
    [currentSteps, ja]
  );

  // Indique si l'étape courante est complète (gate Suivant). Référence stable :
  // lit completion via une ref synchronisée pour ne pas se rebuilder à chaque render.
  const completionRef = useRef<boolean[]>(completion);
  completionRef.current = completion;
  const isStepComplete = useCallback((stepIdx: number): boolean => {
    return completionRef.current[stepIdx] ?? true;
  }, []);

  const handleAnSessChange = useCallback(async (id: string) => {
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
  }, [loadSessionConfig]);

  const saveSession = useCallback(async (id: string, cfg: SessionConfig, meta: Partial<SessionListItem>) => {
    const { error } = await supabase.from("sessions").upsert({
      id,
      name: meta.name ?? cfg.name,
      date: meta.date ?? cfg.date,
      active: meta.active ?? false,
      juror_count: meta.jurorCount ?? 0,
      config: cfg,
      results_visible: meta.resultsVisible ?? false,
    });
    if (error) {
      logDataError("Erreur lors de l'enregistrement de la séance:", error);
      return { success: false, error };
    }
    _configCache.set(id, { cfg, ts: Date.now() });
    return { success: true };
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) {
      logDataError("Erreur lors de la suppression de la séance:", error);
    }
    _configCache.delete(id);
  }, []);

  const listJurorsForSession = useCallback(async (sessionId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from("answers")
      .select("juror_name")
      .eq("session_id", sessionId);
    if (error) {
      logDataError("Erreur lors du listage des jurys:", error);
    }
    if (!data) return [];
    return data.map((r: { juror_name: string }) => r.juror_name);
  }, []);

  const deleteJury = useCallback(async (sessionId: string, name: string) => {
    if (!sessionId) return { success: false };
    const { error } = await supabase
      .from("answers")
      .delete()
      .eq("session_id", sessionId)
      .eq("juror_name", name);
    if (error) {
      logDataError("Erreur lors de la suppression du jury:", error);
      return { success: false };
    }
    const { curSessId, jurors, cj } = stateRef.current;
    if (sessionId === curSessId) {
      const newJurors = jurors.filter(j => j !== name);
      setJurors(newJurors);
      if (cj === name) { setCj(""); setJa({}); }
    }
    const remaining = await listJurorsForSession(sessionId);
    const { error: upError } = await supabase
      .from("sessions")
      .update({ juror_count: remaining.length })
      .eq("id", sessionId);
    if (upError) {
      logDataError("Erreur lors de la mise à jour du compteur de jurys:", upError);
    }
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
  }, [listJurorsForSession]);

  const toggleActive = useCallback(async (id: string) => {
    const { sessions } = stateRef.current;
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    const newActive = !s.active;
    const { error } = await supabase.from("sessions").update({ active: newActive }).eq("id", id);
    if (error) {
      logDataError("Erreur lors de la modification de l'état actif:", error);
    }
    setSessions(prev => prev.map(x => x.id === id ? { ...x, active: newActive } : x));
  }, []);

  // Bascule l'affichage du résumé d'analyse côté participant. Stocké en
  // colonne dédiée pour pouvoir être basculé sans réécrire `config`, et lu
  // par le polling de la liste : tous les jurys verront le bouton passer
  // au vert dans la fenêtre de polling suivante.
  const toggleResultsVisible = useCallback(async (id: string) => {
    const { sessions } = stateRef.current;
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    const next = !s.resultsVisible;
    const { error } = await supabase.from("sessions").update({ results_visible: next }).eq("id", id);
    if (error) {
      logDataError("Erreur lors de la modification de la visibilité des résultats:", error);
    }
    setSessions(prev => prev.map(x => x.id === id ? { ...x, resultsVisible: next } : x));
  }, []);

  // csvData a été extrait dans `lib/csv.ts` (`buildCsvData`) et est désormais
  // calculé à la demande dans AnalyseView via un useMemo local. Le maintenir
  // ici forçait un recalcul à chaque saisie participante alors que personne
  // ne le consommait hors de l'écran d'analyse.

  // Groupe "actions" : toutes les références sont stables (useState setters ou
  // useCallback à deps vides), donc ce useMemo ne se ré-évalue jamais après le
  // premier render. Permet à AppProviders d'exposer un contexte d'actions séparé
  // dont les consommateurs ne se ré-rendront pas sur les changements d'état.
  const actions = useMemo(() => ({
    setMode, setScreen, setAdminAuth, setCs,
    setEditCfg, setEditSessId, setCurEditTab,
    setAnSessId, setCurAnT, setAdminSection,
    loadSessionConfig, loadSessions,
    handleSelectSession, handleLoginJury, handleSelectPoste,
    handleSetJa, validateStep, handleAnSessChange,
    saveSession, deleteSession, deleteJury,
    listJurorsForSession, toggleActive, toggleResultsVisible,
    isStepComplete,
    flushPending, flushSave,
    // Les useState setters sont stables par contrat React et n'ont pas besoin
    // d'être listés en deps.
  }), [
    loadSessionConfig, loadSessions,
    handleSelectSession, handleLoginJury, handleSelectPoste,
    handleSetJa, validateStep, handleAnSessChange,
    saveSession, deleteSession, deleteJury,
    listJurorsForSession, toggleActive, toggleResultsVisible,
    isStepComplete, flushPending, flushSave,
  ]);

  // Groupe "state" : valeurs réactives + dérivées. Bust à chaque changement d'état,
  // ce qui est attendu — les consommateurs qui n'ont pas besoin de l'état peuvent
  // s'abonner uniquement à `actions`.
  const state = useMemo(() => ({
    mode, screen, sessions, loading, restored, adminAuth, online,
    curSessId, curSess,
    jurors, cj, ja, cs,
    poste, takenPostes, validatedSteps,
    editCfg, editSessId, curEditTab,
    anSessId, anCfg, allAnswers, curAnT,
    adminSection, saveStatus, pendingCount,
    currentSteps, completion,
  }), [
    mode, screen, sessions, loading, restored, adminAuth, online,
    curSessId, curSess,
    jurors, cj, ja, cs,
    poste, takenPostes, validatedSteps,
    editCfg, editSessId, curEditTab,
    anSessId, anCfg, allAnswers, curAnT,
    adminSection, saveStatus, pendingCount,
    currentSteps, completion,
  ]);

  return { state, actions };
};

// Types publics pour les consommateurs et les contextes.
export type SensoState = ReturnType<typeof useSenso>["state"];
export type SensoActions = ReturnType<typeof useSenso>["actions"];
