"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiPrinter, FiRefreshCw, FiTrash2, FiUserPlus } from "react-icons/fi";
import { SlotCalendar, type SlotCalendarItem } from "../../features/SlotCalendar";
import { Button } from "../../ui/Button";
import type { SessionListItem } from "../../../types";
import type { AdminSlotListItem } from "../../../types/slots";
import { formatSlotDateLong, SLOT_CAPACITY, SLOT_TIME_LABEL } from "../../../lib/slots/dates";

type SlotAdminViewProps = {
  sessions: SessionListItem[];
};

const panelClass = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)] p-4 shadow-[var(--shadow)]";

const readApiError = async (response: Response, fallback: string) => {
  const statusLabel = `HTTP ${response.status}`;
  try {
    const payload = await response.json() as { error?: string; detail?: string };
    const message = payload.detail || payload.error;
    if (message) return `${message} (${statusLabel})`;
  } catch {
    // Keep the status visible when the response body is not JSON.
  }
  return `${fallback} (${statusLabel})`;
};

export const SlotAdminView = ({ sessions }: SlotAdminViewProps) => {
  const [slots, setSlots] = useState<AdminSlotListItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotDates, setSelectedSlotDates] = useState<Set<string>>(() => new Set());
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [slotDate, setSlotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessionId, setSessionId] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedSlot = useMemo(
    () => slots.find(slot => slot.id === selectedSlotId) || null,
    [slots, selectedSlotId]
  );

  const calendarSlots: SlotCalendarItem[] = slots.map(slot => ({
    id: slot.id,
    slotDate: slot.slotDate,
    placesTaken: slot.placesTaken,
    capacity: slot.capacity,
  }));

  const pendingSlotDates = useMemo(() => {
    const dates = Array.from(selectedSlotDates).sort();
    return dates.length > 0 ? dates : [slotDate];
  }, [selectedSlotDates, slotDate]);

  const loadAll = async () => {
    setBusy(true);
    try {
      const slotsResponse = await fetch("/api/admin/slots", { cache: "no-store" });
      if (!slotsResponse.ok) {
        const text = slotsResponse.status === 401
          ? "Session admin expirée. Déconnectez-vous puis reconnectez-vous. (HTTP 401)"
          : await readApiError(slotsResponse, "Impossible de charger les créneaux admin.");
        setMessage({ kind: "error", text });
        return;
      }

      const slotsPayload = await slotsResponse.json();
      setSlots(slotsPayload.slots || []);
    } catch {
      setMessage({ kind: "error", text: "Impossible de charger les créneaux admin." });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const createSlot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotDate,
          slotDates: pendingSlotDates,
          sessionId: sessionId || null,
          sessionName,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setMessage({ kind: "error", text: payload.error || "Création impossible." });
        return;
      }

      const createdCount = payload.created?.length || 0;
      const attachedCount = payload.attached?.length || 0;
      setMessage({ kind: "ok", text: `${createdCount} créneau(x) créé(s), ${attachedCount} créneau(x) rattaché(s).` });
      setSelectedDate(pendingSlotDates[0] || slotDate);
      setSelectedSlotDates(new Set());
      await loadAll();
    } catch {
      setMessage({ kind: "error", text: "Erreur lors de la création du créneau." });
    } finally {
      setBusy(false);
    }
  };

  const deleteSlot = async () => {
    if (!selectedSlot || busy) return;
    const ok = confirm(`Supprimer le créneau du ${formatSlotDateLong(selectedSlot.slotDate)} ? Les inscriptions liées seront annulées.`);
    if (!ok) return;
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/slots/${selectedSlot.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setMessage({ kind: "error", text: payload.error || "Suppression impossible." });
        return;
      }

      setMessage({ kind: "ok", text: `Créneau supprimé. ${payload.cancelledCount || 0} inscription(s) annulée(s).` });
      setSelectedSlotId(null);
      await loadAll();
    } catch {
      setMessage({ kind: "error", text: "Erreur lors de la suppression." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[22px] font-extrabold text-[var(--ink)]">Créneaux d&apos;inscription</h2>
        <div className="flex-1" />
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--paper)] text-[var(--mid)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
          onClick={() => void loadAll()}
          title="Actualiser"
          aria-label="Actualiser"
        >
          <FiRefreshCw />
        </button>
      </div>

      {message && (
        <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${
          message.kind === "ok"
            ? "border-[rgba(98,141,23,.24)] bg-[rgba(98,141,23,.09)] text-[var(--primary)]"
            : "border-[rgba(198,40,40,.22)] bg-[rgba(198,40,40,.08)] text-[var(--danger)]"
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)] xl:grid-rows-[auto_1fr] xl:items-stretch">
        <div className={`${panelClass} xl:row-span-2`}>
          <SlotCalendar
            slots={calendarSlots}
            selectedDate={selectedDate}
            selectedDates={selectedSlotDates}
            onSelectDate={(date, slot) => {
              setSelectedSlotDates(prev => {
                const next = new Set(prev);
                if (next.has(date)) next.delete(date);
                else next.add(date);
                return next;
              });
              setSelectedDate(date);
              setSelectedSlotId(slot?.id || null);
              setSlotDate(date);
            }}
          />
        </div>

        <div className={`${panelClass} min-h-[190px]`}>
          {selectedSlot ? (
            <div className="space-y-3.5">
              <div>
                <div className="text-base font-bold text-[var(--ink)]">{formatSlotDateLong(selectedSlot.slotDate)}</div>
                <div className="mt-1 text-sm text-[var(--mid)]">{selectedSlot.sessionName}</div>
                <div className="mt-2.5 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full border border-[var(--border)] bg-[var(--paper2)] px-3 py-1 font-semibold">
                    {selectedSlot.placesTaken}/{selectedSlot.capacity || SLOT_CAPACITY} places prises
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--paper2)] px-3 py-1 font-semibold">
                    {SLOT_TIME_LABEL}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-bold text-[var(--ink)]">Participants</div>
                {selectedSlot.participants.length === 0 ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--paper2)] p-3 text-sm text-[var(--mid)]">
                    Aucun participant inscrit.
                  </div>
                ) : (
                  <div className="max-h-[190px] overflow-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead className="bg-[var(--paper2)] text-xs uppercase text-[var(--mid)]">
                        <tr>
                          <th className="px-3 py-2">Nom</th>
                          <th className="px-3 py-2">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSlot.participants.map(participant => (
                          <tr key={participant.id} className="border-t border-[var(--border)]">
                            <td className="px-3 py-2 font-medium">{participant.participantName}</td>
                            <td className="px-3 py-2 font-mono text-xs text-[var(--mid)]">{participant.participantEmail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
                  <FiPrinter /> Imprimer émargement
                </Button>
                <Button type="button" variant="dangerGhost" size="sm" onClick={() => void deleteSlot()} disabled={busy}>
                  <FiTrash2 /> Supprimer
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-2 text-base font-bold text-[var(--ink)]">
                {selectedDate ? formatSlotDateLong(selectedDate) : "Détail du créneau"}
              </div>
              <div className="text-sm text-[var(--mid)]">
                {selectedDate ? "Aucun créneau ouvert sur cette date." : "Sélectionnez une date du calendrier."}
              </div>
            </div>
          )}
        </div>

        <form className={`${panelClass} self-stretch`} onSubmit={createSlot}>
          <h3 className="mb-3 text-base font-bold text-[var(--ink)]">Ouvrir un créneau</h3>
          <div className="grid gap-3">
            {selectedSlotDates.size > 0 && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--paper2)] px-3 py-2 text-sm text-[var(--mid)]">
                <span className="font-semibold text-[var(--ink)]">{selectedSlotDates.size} date(s) sélectionnée(s)</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Array.from(selectedSlotDates).sort().map(date => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => {
                        setSelectedSlotDates(prev => {
                          const next = new Set(prev);
                          next.delete(date);
                          return next;
                        });
                      }}
                      className="rounded-full border border-[var(--border)] bg-[var(--paper)] px-2 py-1 text-xs font-semibold text-[var(--mid)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
                    >
                      {formatSlotDateLong(date)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-[var(--mid)]">Date</label>
              <input
                type="date"
                value={slotDate}
                onChange={(event) => setSlotDate(event.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-[var(--mid)]">Séance existante optionnelle</label>
              <select
                value={sessionId}
                onChange={(event) => {
                  const id = event.target.value;
                  setSessionId(id);
                  const session = sessions.find(item => item.id === id);
                  if (session) setSessionName(session.name);
                }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--primary)]"
              >
                <option value="">Aucune séance rattachée</option>
                {sessions.map(session => (
                  <option key={session.id} value={session.id}>{session.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-[var(--mid)]">Nom de séance</label>
              <input
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--primary)]"
              />
            </div>
            <Button type="submit" disabled={busy}>
              <FiUserPlus /> {pendingSlotDates.length > 1 ? "Créer les créneaux" : "Créer le créneau"}
            </Button>
          </div>
        </form>
      </div>

      {selectedSlot && (
        <div className="print-sheet">
          <h1>Fiche d&apos;émargement</h1>
          <div className="print-meta">
            <div><strong>Date :</strong> {formatSlotDateLong(selectedSlot.slotDate)}</div>
            <div><strong>Séance :</strong> {selectedSlot.sessionName}</div>
            <div><strong>Heure :</strong> {SLOT_TIME_LABEL}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Participant</th>
                <th>Signature</th>
              </tr>
            </thead>
            <tbody>
              {selectedSlot.participants.map(participant => (
                <tr key={participant.id}>
                  <td>{participant.participantName}</td>
                  <td />
                </tr>
              ))}
              {selectedSlot.participants.length === 0 && (
                <tr>
                  <td colSpan={2}>Aucun participant inscrit.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
