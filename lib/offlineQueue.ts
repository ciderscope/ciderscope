// File d'attente locale pour les réponses non synchronisées.
// Chaque entrée représente l'état "à jour" que le serveur n'a pas encore reçu.

const KEY = "senso_pending_answers_v1";

export interface PendingEntry {
  sessionId: string;
  jurorName: string;
  data: unknown;
  ts: number;
}

const readAll = (): PendingEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as PendingEntry[] : [];
  } catch { return []; }
};

const writeAll = (entries: PendingEntry[]) => {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* quota */ }
};

export const queuePending = (sessionId: string, jurorName: string, data: unknown) => {
  const all = readAll().filter(e => !(e.sessionId === sessionId && e.jurorName === jurorName));
  all.push({ sessionId, jurorName, data, ts: Date.now() });
  writeAll(all);
};

export const clearPending = (sessionId: string, jurorName: string) => {
  const all = readAll().filter(e => !(e.sessionId === sessionId && e.jurorName === jurorName));
  writeAll(all);
};

export const listPending = (): PendingEntry[] => readAll();

export const countPending = (): number => readAll().length;
