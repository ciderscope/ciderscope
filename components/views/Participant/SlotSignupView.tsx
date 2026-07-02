"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiCheck, FiRefreshCw, FiTrash2, FiUserPlus } from "react-icons/fi";
import { SlotCalendar, type SlotCalendarItem } from "../../features/SlotCalendar";
import { Button } from "../../ui/Button";
import type { SlotListItem } from "../../../types/slots";
import { formatSlotDateLong, SLOT_CAPACITY, SLOT_TIME_LABEL } from "../../../lib/slots/dates";
import { normalizeEmail } from "../../../lib/slots/validation";

const panelClass = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)] p-5 shadow-[var(--shadow)]";

export const SlotSignupView = () => {
  const [slots, setSlots] = useState<SlotListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [cancelEmail, setCancelEmail] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSlots = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/public/slots", { cache: "no-store" });
      const payload = await response.json();
      setSlots(payload.slots || []);
    } catch {
      setMessage({ kind: "error", text: "Impossible de charger les créneaux." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSlots();
  }, []);

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

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSlot || busy) return;
    if (selectedSlot.placesTaken >= selectedSlot.capacity) {
      setMessage({ kind: "error", text: "Ce créneau est complet." });
      return;
    }

    setBusy(true);
    setMessage(null);
    setDuplicateEmail(null);
    try {
      const response = await fetch(`/api/public/slots/${selectedSlot.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantName, participantEmail }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        if (payload.code === "already_registered") {
          setDuplicateEmail(normalizeEmail(participantEmail));
        }
        setMessage({ kind: "error", text: payload.message || "Inscription impossible." });
        return;
      }

      const outlookStatus = payload.outlookInvitation?.status;
      setMessage({
        kind: outlookStatus === "failed" || outlookStatus === "not_configured" ? "error" : "ok",
        text: outlookStatus === "sent"
          ? "Inscription confirmée. L'invitation Outlook vient d'être envoyée."
          : outlookStatus === "failed" || outlookStatus === "not_configured"
            ? "Inscription confirmée, mais l'invitation Outlook n'a pas pu être envoyée automatiquement."
            : "Inscription confirmée.",
      });
      setParticipantName("");
      setParticipantEmail("");
      await loadSlots();
    } catch {
      setMessage({ kind: "error", text: "Erreur lors de l'inscription." });
    } finally {
      setBusy(false);
    }
  };

  const cancelRegistration = async (email: string) => {
    if (!selectedSlot || busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/public/slots/${selectedSlot.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantEmail: email }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMessage({ kind: "error", text: payload.message || "Annulation impossible." });
        return;
      }

      setDuplicateEmail(null);
      setCancelEmail("");
      setMessage({
        kind: "ok",
        text: payload.alreadyCancelled
          ? "Participation déjà annulée."
          : payload.outlookCancellation?.status === "cancelled"
            ? "Participation annulée. L'invitation Outlook a été annulée."
            : payload.outlookCancellation?.status === "failed" || payload.outlookCancellation?.status === "not_configured"
              ? "Participation annulée, mais l'invitation Outlook n'a pas pu être annulée automatiquement."
            : "Participation annulée.",
      });
      await loadSlots();
    } catch {
      setMessage({ kind: "error", text: "Erreur lors de l'annulation." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto mb-12 max-w-[1100px] text-left">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-extrabold text-[var(--ink)]">Inscription aux créneaux</h2>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--paper)] text-[var(--mid)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
          onClick={() => void loadSlots()}
          title="Actualiser"
          aria-label="Actualiser les créneaux"
        >
          <FiRefreshCw />
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]">
        <div className={panelClass}>
          {loading ? (
            <div className="p-8 text-center text-[var(--mid)]">Chargement des créneaux...</div>
          ) : (
            <SlotCalendar
              slots={calendarSlots}
              selectedDate={selectedDate}
              onSelectDate={(date, slot) => {
                setSelectedDate(date);
                setSelectedSlotId(slot?.id || null);
                setMessage(null);
                setDuplicateEmail(null);
              }}
            />
          )}
        </div>

        <div className={panelClass}>
          {!selectedDate && (
            <div className="text-sm text-[var(--mid)]">Sélectionnez une date ouverte.</div>
          )}

          {selectedDate && !selectedSlot && (
            <div>
              <div className="text-base font-bold text-[var(--ink)]">{formatSlotDateLong(selectedDate)}</div>
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--paper2)] p-4 text-sm text-[var(--mid)]">
                Aucun créneau ouvert sur cette date.
              </div>
            </div>
          )}

          {selectedSlot && (
            <div className="space-y-5">
              <div>
                <div className="text-base font-bold text-[var(--ink)]">{formatSlotDateLong(selectedSlot.slotDate)}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full border border-[var(--border)] bg-[var(--paper2)] px-3 py-1 font-semibold">
                    {selectedSlot.placesTaken}/{selectedSlot.capacity || SLOT_CAPACITY} places prises
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--paper2)] px-3 py-1 font-semibold">
                    {SLOT_TIME_LABEL}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-bold text-[var(--ink)]">Inscrits</div>
                {selectedSlot.participants.length === 0 ? (
                  <div className="text-sm text-[var(--mid)]">Aucun inscrit pour le moment.</div>
                ) : (
                  <ul className="grid gap-1.5 text-sm text-[var(--ink)]">
                    {selectedSlot.participants.map(participant => (
                      <li key={participant.id} className="rounded-lg bg-[var(--paper2)] px-3 py-2">
                        {participant.participantName}
                      </li>
                    ))}
                  </ul>
                )}
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

              {selectedSlot.placesTaken < selectedSlot.capacity ? (
                <form className="space-y-3" onSubmit={register}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-[var(--mid)]">Nom</label>
                      <input
                        value={participantName}
                        onChange={(event) => setParticipantName(event.target.value)}
                        required
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-[var(--mid)]">Email</label>
                      <input
                        type="email"
                        value={participantEmail}
                        onChange={(event) => setParticipantEmail(event.target.value)}
                        required
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={busy}>
                    <FiUserPlus /> S&apos;inscrire
                  </Button>
                </form>
              ) : (
                <div className="rounded-lg border border-[rgba(198,40,40,.22)] bg-[rgba(198,40,40,.08)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
                  Ce créneau est complet.
                </div>
              )}

              <div className="border-t border-[var(--border)] pt-4">
                <label className="mb-1 block text-xs font-bold uppercase text-[var(--mid)]">Annuler avec mon email</label>
                <div className="flex gap-2 max-[520px]:flex-col">
                  <input
                    type="email"
                    value={cancelEmail}
                    onChange={(event) => setCancelEmail(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--primary)]"
                  />
                  <Button
                    type="button"
                    variant="dangerGhost"
                    disabled={busy || !cancelEmail}
                    onClick={() => void cancelRegistration(cancelEmail)}
                  >
                    <FiTrash2 /> Annuler
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {duplicateEmail && selectedSlot && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-[480px] rounded-xl bg-[var(--paper)] p-6 shadow-[0_8px_24px_rgba(0,0,0,.2)]">
            <div className="mb-2 text-lg font-bold text-[var(--ink)]">Email déjà inscrit</div>
            <p className="mb-5 text-sm leading-relaxed text-[var(--mid)]">
              {duplicateEmail} est déjà inscrit sur le créneau du {formatSlotDateLong(selectedSlot.slotDate)}.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDuplicateEmail(null)} disabled={busy}>
                Garder l&apos;inscription
              </Button>
              <Button variant="danger" size="sm" onClick={() => void cancelRegistration(duplicateEmail)} disabled={busy}>
                <FiCheck /> Annuler ma participation
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
