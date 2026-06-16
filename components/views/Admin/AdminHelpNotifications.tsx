"use client";

import React, { useEffect, useRef, useState } from "react";
import { FiBell, FiVolume2, FiX } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { getHelpRequests } from "../../../lib/helpRequests";
import { supabase } from "../../../lib/supabase";
import type { HelpRequest, JurorAnswers } from "../../../types";

type AnswerRow = {
  juror_name?: string | null;
  data?: JurorAnswers | null;
};

type HelpNotification = HelpRequest & {
  jurorName: string;
  sessionId: string;
  sessionName?: string;
};

type BrowserWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const seenStorageKey = (sessionId: string) => `senso_seen_help_requests_v1:${sessionId}`;

const readSeen = (sessionId: string): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(seenStorageKey(sessionId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
};

const writeSeen = (sessionId: string, seen: Set<string>) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(seenStorageKey(sessionId), JSON.stringify(Array.from(seen).slice(-250)));
  } catch {
    // Storage quota/private mode: the popup still works for this render.
  }
};

const collectNotifications = (
  rows: AnswerRow[],
  sessionId: string,
  sessionName: string | undefined
): HelpNotification[] => {
  return rows.flatMap(row => {
    const jurorName = row.juror_name?.trim();
    if (!jurorName) return [];
    return getHelpRequests(row.data).map(request => ({
      ...request,
      jurorName,
      sessionId,
      sessionName,
    }));
  });
};

const playHelpSound = () => {
  if (typeof window === "undefined") return;
  try {
    const audioWindow = window as BrowserWindow;
    const AudioCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    gain.connect(ctx.destination);

    [880, 660].forEach((frequency, index) => {
      const offset = index * 0.16;
      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      oscillator.connect(gain);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.12);
    });

    window.setTimeout(() => { void ctx.close(); }, 650);
  } catch {
    // Browser autoplay/audio policies can block sound; the visual alert remains.
  }
};

const formatRequestTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

interface AdminHelpNotificationsProps {
  sessionId: string | null;
  sessionName?: string;
}

export const AdminHelpNotifications = ({ sessionId, sessionName }: AdminHelpNotificationsProps) => {
  const [queueState, setQueueState] = useState<{ sessionId: string | null; items: HelpNotification[] }>({
    sessionId: null,
    items: [],
  });
  const seenRef = useRef<Set<string>>(new Set());
  const queue = queueState.sessionId === sessionId ? queueState.items : [];
  const active = queue[0] || null;

  useEffect(() => {
    if (!sessionId) {
      seenRef.current = new Set();
      return;
    }

    let cancelled = false;
    seenRef.current = readSeen(sessionId);

    const pushNewNotifications = (rows: AnswerRow[]) => {
      const next = collectNotifications(rows, sessionId, sessionName)
        .filter(notification => !seenRef.current.has(notification.id))
        .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));

      if (next.length === 0 || cancelled) return;

      for (const notification of next) seenRef.current.add(notification.id);
      writeSeen(sessionId, seenRef.current);
      setQueueState(prev => ({
        sessionId,
        items: prev.sessionId === sessionId ? [...prev.items, ...next] : next,
      }));
      playHelpSound();
    };

    const fetchRequests = async () => {
      const { data, error } = await supabase
        .from("answers")
        .select("juror_name, data")
        .eq("session_id", sessionId);

      if (error || cancelled) return;
      pushNewNotifications((data || []) as AnswerRow[]);
    };

    void fetchRequests();

    const intervalId = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchRequests();
    }, 5_000);

    const channel = supabase
      .channel(`admin-help-${sessionId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers", filter: `session_id=eq.${sessionId}` },
        payload => {
          const row = (payload as { new?: unknown }).new;
          if (row && typeof row === "object" && !Array.isArray(row)) {
            pushNewNotifications([row as AnswerRow]);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      void supabase.removeChannel(channel);
    };
  }, [sessionId, sessionName]);

  if (!sessionId || !active) return null;

  const requestTime = formatRequestTime(active.requestedAt);
  const dismissActive = () => {
    setQueueState(prev => (
      prev.sessionId === sessionId
        ? { sessionId, items: prev.items.slice(1) }
        : prev
    ));
  };

  return (
    <div className="fixed right-3 top-18 z-[220] w-[min(92vw,390px)] sm:right-5 sm:top-20" role="alertdialog" aria-modal="true" aria-labelledby="admin-help-title">
      <div className="rounded-xl border border-[#e1b94c] border-l-4 bg-[var(--paper)] p-4 shadow-[0_16px_46px_rgba(0,0,0,.18)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff0b8] text-[#8a5a00]">
            <FiBell size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div id="admin-help-title" className="text-base font-extrabold leading-tight text-[var(--ink)]">Besoin d&apos;aide</div>
            <p className="mt-1 text-sm leading-relaxed text-[var(--ink)]">
              <strong>{active.jurorName}</strong> a besoin d&apos;aide.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--mid)]">
              {active.sessionName && <span className="font-mono">{active.sessionName}</span>}
              <span>Étape {active.stepIndex + 1}</span>
              {requestTime && <span>{requestTime}</span>}
              <span className="inline-flex items-center gap-1 text-[#8a5a00]"><FiVolume2 /> Signal sonore</span>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[var(--mid)] transition-colors hover:bg-[var(--paper2)] hover:text-[var(--ink)]"
            onClick={dismissActive}
            aria-label="Fermer la notification"
            title="Fermer"
          >
            <FiX />
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" size="sm" onClick={dismissActive}>
            J&apos;ai vu
          </Button>
        </div>
      </div>
    </div>
  );
};
