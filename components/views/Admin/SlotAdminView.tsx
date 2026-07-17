"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiPrinter, FiRefreshCw, FiTrash2, FiUserMinus, FiUserPlus, FiX } from "react-icons/fi";
import { SlotCalendar, type SlotCalendarItem } from "../../features/SlotCalendar";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import type { SessionListItem } from "../../../types";
import type { AdminSlotListItem, AdminSlotParticipant } from "../../../types/slots";
import { formatSlotDateLong, SLOT_CAPACITY, SLOT_TIME_LABEL } from "../../../lib/slots/dates";

type SlotAdminViewProps = {
  sessions: SessionListItem[];
};

const SLOT_REFRESH_INTERVAL_MS = 15_000;

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
  const [selectedSlotDates, setSelectedSlotDates] = useState<Set<string>>(() => new Set());
  const [sessionId, setSessionId] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "warning" | "error"; text: string } | null>(null);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [printSlotId, setPrintSlotId] = useState<string | null>(null);
  const refreshInFlightRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const selectedSlots = useMemo(() => (
    slots.filter(slot => selectedSlotDates.has(slot.slotDate))
  ), [slots, selectedSlotDates]);

  const printSlot = useMemo(
    () => slots.find(slot => slot.id === printSlotId) || null,
    [slots, printSlotId]
  );
  const printConfirmedParticipants = printSlot?.participants.filter(participant => (
    participant.registrationStatus === "confirmed"
  )) || [];

  const calendarSlots: SlotCalendarItem[] = slots.map(slot => ({
    id: slot.id,
    slotDate: slot.slotDate,
    placesTaken: slot.placesTaken,
    capacity: slot.capacity,
    waitlistCount: slot.waitlistCount,
  }));

  const pendingSlotDates = useMemo(() => {
    return Array.from(selectedSlotDates).sort();
  }, [selectedSlotDates]);

  const loadAll = useCallback(async (silent = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (!silent) setBusy(true);
    try {
      const slotsResponse = await fetch("/api/admin/slots", { cache: "no-store" });
      if (!slotsResponse.ok) {
        if (silent) return;
        const text = slotsResponse.status === 401
          ? "Session admin expirée. Déconnectez-vous puis reconnectez-vous. (HTTP 401)"
          : await readApiError(slotsResponse, "Impossible de charger les créneaux admin.");
        setMessage({ kind: "error", text });
        return;
      }

      const slotsPayload = await slotsResponse.json();
      setSlots(slotsPayload.slots || []);
    } catch {
      if (!silent) {
        setMessage({ kind: "error", text: "Impossible de charger les créneaux admin." });
      }
    } finally {
      refreshInFlightRef.current = false;
      if (!silent) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();

    const refreshVisibleSlots = () => {
      if (document.visibilityState === "visible") void loadAll(true);
    };
    const intervalId = window.setInterval(refreshVisibleSlots, SLOT_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshVisibleSlots);
    document.addEventListener("visibilitychange", refreshVisibleSlots);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshVisibleSlots);
      document.removeEventListener("visibilitychange", refreshVisibleSlots);
    };
  }, [loadAll]);

  useEffect(() => {
    if (!printSlotId) return;

    const resetPrintSlot = () => setPrintSlotId(null);
    const timeoutId = window.setTimeout(() => window.print(), 0);
    window.addEventListener("afterprint", resetPrintSlot, { once: true });

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("afterprint", resetPrintSlot);
    };
  }, [printSlotId]);

  const createSlot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);

    if (pendingSlotDates.length === 0) {
      setMessage({ kind: "error", text: "Sélectionnez au moins une date dans le calendrier." });
      setBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      const skippedCount = payload.skipped?.length || 0;
      setMessage({
        kind: skippedCount > 0 && createdCount === 0 && attachedCount === 0 ? "error" : "ok",
        text: skippedCount > 0
          ? `${createdCount} créneau(x) créé(s), ${attachedCount} créneau(x) rattaché(s), ${skippedCount} date(s) ignorée(s).`
          : `${createdCount} créneau(x) créé(s), ${attachedCount} créneau(x) rattaché(s).`,
      });
      setSelectedSlotDates(new Set());
      await loadAll();
    } catch {
      setMessage({ kind: "error", text: "Erreur lors de la création du créneau." });
    } finally {
      setBusy(false);
    }
  };

  const deleteSlot = async (slot: AdminSlotListItem) => {
    if (busy) return;
    const ok = confirm(`Supprimer le créneau du ${formatSlotDateLong(slot.slotDate)} ? Les inscriptions liées seront annulées.`);
    if (!ok) return;
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/slots/${slot.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setMessage({ kind: "error", text: payload.error || "Suppression impossible." });
        return;
      }

      setMessage({ kind: "ok", text: `Créneau supprimé. ${payload.cancelledCount || 0} inscription(s) annulée(s).` });
      setSelectedSlotDates(prev => {
        const next = new Set(prev);
        next.delete(slot.slotDate);
        return next;
      });
      await loadAll();
    } catch {
      setMessage({ kind: "error", text: "Erreur lors de la suppression." });
    } finally {
      setBusy(false);
    }
  };

  const removeParticipant = async (slot: AdminSlotListItem, participant: AdminSlotParticipant) => {
    if (removingParticipantId) return;

    const promotionNotice = participant.registrationStatus === "confirmed" && slot.waitlistCount > 0
      ? " La première personne en liste d'attente sera automatiquement confirmée."
      : "";
    const ok = confirm(
      `Retirer ${participant.participantName} du créneau du ${formatSlotDateLong(slot.slotDate)} ?${promotionNotice}`
    );
    if (!ok) return;

    setRemovingParticipantId(participant.id);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/slots/${slot.id}/registrations/${participant.id}`,
        { method: "DELETE" }
      );
      const payload = await response.json().catch(() => ({})) as {
        ok?: boolean;
        error?: string;
        removedRegistrationId?: string;
        promotedRegistration?: { id: string; participantName: string } | null;
        outlookCancellationStatus?: string | null;
        outlookPromotionStatus?: string | null;
      };

      if (!response.ok || !payload.ok || !payload.removedRegistrationId) {
        setMessage({ kind: "error", text: payload.error || "Impossible de retirer cette personne." });
        void loadAll(true);
        return;
      }

      setSlots(prev => prev.map(currentSlot => {
        if (currentSlot.id !== slot.id) return currentSlot;

        const participants = currentSlot.participants
          .filter(item => item.id !== payload.removedRegistrationId)
          .map(item => item.id === payload.promotedRegistration?.id
            ? { ...item, registrationStatus: "confirmed" as const }
            : item)
          .sort((left, right) => {
            if (left.registrationStatus !== right.registrationStatus) {
              return left.registrationStatus === "confirmed" ? -1 : 1;
            }
            return left.createdAt.localeCompare(right.createdAt);
          });

        return {
          ...currentSlot,
          participants,
          placesTaken: participants.filter(item => item.registrationStatus === "confirmed").length,
          waitlistCount: participants.filter(item => item.registrationStatus === "waitlist").length,
        };
      }));

      const promotedText = payload.promotedRegistration
        ? ` ${payload.promotedRegistration.participantName} a été automatiquement confirmé(e).`
        : "";
      const outlookWarning = [payload.outlookCancellationStatus, payload.outlookPromotionStatus]
        .some(status => status === "failed" || status === "not_configured");
      setMessage({
        kind: outlookWarning ? "warning" : "ok",
        text: `${participant.participantName} a été retiré(e) du créneau.${promotedText}${
          outlookWarning ? " La synchronisation Outlook est à vérifier." : ""
        }`,
      });
      void loadAll(true);
    } catch {
      setMessage({ kind: "error", text: "Erreur lors de la désinscription." });
    } finally {
      setRemovingParticipantId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-[22px] font-extrabold text-[var(--ink)]">Créneaux d&apos;inscription</h2>
          <p className="mt-1 text-sm text-[var(--mid)]">
            Sélectionnez plusieurs dates pour gérer leurs inscriptions côte à côte.
          </p>
        </div>
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
            : message.kind === "warning"
              ? "border-[rgba(238,140,0,.28)] bg-[rgba(238,140,0,.10)] text-[var(--accent)]"
              : "border-[rgba(198,40,40,.22)] bg-[rgba(198,40,40,.08)] text-[var(--danger)]"
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)]">
        <Card className="!mb-0 !p-4 xl:sticky xl:top-4">
          <SlotCalendar
            slots={calendarSlots}
            selectedDates={selectedSlotDates}
            compact
            onSelectDate={(date) => {
              setSelectedSlotDates(prev => {
                const next = new Set(prev);
                if (next.has(date)) next.delete(date);
                else next.add(date);
                return next;
              });
            }}
          />
        </Card>

        <div className="min-w-0 space-y-4">
          <div className="flex min-h-9 flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[var(--ink)]">Créneaux sélectionnés</h3>
            <Badge variant={selectedSlots.length > 0 ? "active" : "inactive"}>
              {selectedSlots.length}
            </Badge>
            <div className="flex-1" />
            {selectedSlotDates.size > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSlotDates(new Set())}
              >
                <FiX /> Tout désélectionner
              </Button>
            )}
          </div>

          {selectedSlots.length === 0 ? (
            <Card className="!mb-0 !p-4">
              <div className="text-sm text-[var(--mid)]">
                {selectedSlotDates.size > 0
                  ? "Aucun créneau n'est encore ouvert sur les dates sélectionnées. Vous pouvez les créer ci-dessous."
                  : "Sélectionnez une ou plusieurs dates du calendrier pour afficher leurs créneaux."}
              </div>
            </Card>
          ) : selectedSlots.map(slot => (
            <Card key={slot.id} className="!mb-0 !p-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold text-[var(--ink)]">{formatSlotDateLong(slot.slotDate)}</div>
                    <div className="mt-1 break-words text-sm text-[var(--mid)]">{slot.sessionName}</div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--mid)] hover:bg-[var(--paper2)] hover:text-[var(--ink)]"
                    onClick={() => setSelectedSlotDates(prev => {
                      const next = new Set(prev);
                      next.delete(slot.slotDate);
                      return next;
                    })}
                    title="Masquer ce créneau"
                    aria-label={`Masquer le créneau du ${formatSlotDateLong(slot.slotDate)}`}
                  >
                    <FiX />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full border border-[var(--border)] bg-[var(--paper2)] px-3 py-1 font-semibold text-[var(--ink)]">
                    {slot.placesTaken}/{slot.capacity || SLOT_CAPACITY} places prises
                  </span>
                  {slot.waitlistCount > 0 && (
                    <span className="rounded-full border border-[rgba(238,140,0,.28)] bg-[rgba(238,140,0,.10)] px-3 py-1 font-semibold text-[var(--accent)]">
                      {slot.waitlistCount} en attente
                    </span>
                  )}
                  <span className="rounded-full border border-[var(--border)] bg-[var(--paper2)] px-3 py-1 font-semibold text-[var(--ink)]">
                    {SLOT_TIME_LABEL}
                  </span>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
                    Participants
                    <span className="font-normal text-[var(--mid)]">({slot.participants.length})</span>
                  </div>
                  {slot.participants.length === 0 ? (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--paper2)] p-3 text-sm text-[var(--mid)]">
                      Aucun participant inscrit.
                    </div>
                  ) : (
                    <div className="max-h-[300px] divide-y divide-[var(--border)] overflow-y-auto rounded-lg border border-[var(--border)]">
                      {slot.participants.map(participant => (
                        <div key={participant.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                          <div className="min-w-[180px] flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-[var(--ink)]">{participant.participantName}</span>
                              <Badge variant={participant.registrationStatus === "confirmed" ? "ok" : "ns"}>
                                {participant.registrationStatus === "waitlist" ? "Liste d'attente" : "Confirmé"}
                              </Badge>
                            </div>
                            <div className="mt-1 break-all font-mono text-xs text-[var(--mid)]">
                              {participant.participantEmail}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="dangerGhost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => void removeParticipant(slot, participant)}
                            disabled={Boolean(removingParticipantId)}
                            aria-label={`Retirer ${participant.participantName} du créneau`}
                          >
                            {removingParticipantId === participant.id
                              ? <FiRefreshCw className="animate-spin" />
                              : <FiUserMinus />}
                            {removingParticipantId === participant.id ? "Retrait…" : "Retirer"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPrintSlotId(slot.id)}
                  >
                    <FiPrinter /> Imprimer émargement
                  </Button>
                  <Button
                    type="button"
                    variant="dangerGhost"
                    size="sm"
                    onClick={() => void deleteSlot(slot)}
                    disabled={busy || Boolean(removingParticipantId)}
                  >
                    <FiTrash2 /> Supprimer le créneau
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          <Card className="!mb-0 !p-4">
            <form onSubmit={createSlot}>
              <h3 className="mb-1 text-base font-bold text-[var(--ink)]">Ouvrir ou rattacher un créneau</h3>
              <p className="mb-3 text-sm text-[var(--mid)]">
                Les dates déjà ouvertes seront rattachées à la séance choisie.
              </p>
              <div className="grid gap-3">
                {selectedSlotDates.size > 0 ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--paper2)] px-3 py-2 text-sm text-[var(--mid)]">
                    <span className="font-semibold text-[var(--ink)]">{selectedSlotDates.size} date(s) sélectionnée(s)</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Array.from(selectedSlotDates).sort().map(date => (
                        <button
                          key={date}
                          type="button"
                          onClick={() => setSelectedSlotDates(prev => {
                            const next = new Set(prev);
                            next.delete(date);
                            return next;
                          })}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--paper)] px-2 py-1 text-xs font-semibold text-[var(--mid)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
                          aria-label={`Désélectionner ${formatSlotDateLong(date)}`}
                        >
                          {formatSlotDateLong(date)} <FiX />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--mid)]">
                    Sélectionnez au moins une date dans le calendrier.
                  </div>
                )}
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
                <Button type="submit" disabled={busy || pendingSlotDates.length === 0}>
                  <FiUserPlus /> {
                    selectedSlots.length > 0
                      ? "Créer ou rattacher les créneaux"
                      : pendingSlotDates.length > 1
                        ? "Créer les créneaux"
                        : "Créer le créneau"
                  }
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      {printSlot && (
        <div className="print-sheet">
          <h1>Fiche d&apos;émargement</h1>
          <div className="print-meta">
            <div><strong>Date :</strong> {formatSlotDateLong(printSlot.slotDate)}</div>
            <div><strong>Séance :</strong> {printSlot.sessionName}</div>
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
              {printConfirmedParticipants.map(participant => (
                <tr key={participant.id}>
                  <td>{participant.participantName}</td>
                  <td />
                </tr>
              ))}
              {printConfirmedParticipants.length === 0 && (
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
