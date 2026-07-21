"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiRefreshCw, FiUserPlus, FiX } from "react-icons/fi";
import { SlotCalendar, type SlotCalendarItem } from "../../features/SlotCalendar";
import { Button } from "../../ui/Button";
import { ConfirmModal } from "./ConfirmModal";
import type { SlotListItem } from "../../../types/slots";
import { formatSlotDateLong, SLOT_CAPACITY, SLOT_TIME_LABEL } from "../../../lib/slots/dates";

const panelClass = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)] p-5 shadow-[var(--shadow)]";
const SLOT_REFRESH_INTERVAL_MS = 15_000;

type BatchRegistrationResult = {
  ok: boolean;
  slotId: string;
  message?: string;
  registration?: {
    registrationStatus?: "confirmed" | "waitlist";
  };
  outlookInvitation?: {
    status?: "sent" | "failed" | "not_configured" | "skipped" | "cancelled";
  };
};

type RegistrationNotice = {
  dates: Array<{
    slotDate: string;
    registrationStatus: "confirmed" | "waitlist";
  }>;
  hasWarning: boolean;
  note: string;
};

export const SlotSignupView = () => {
  const [slots, setSlots] = useState<SlotListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [participantEmail, setParticipantEmail] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmingRegistration, setConfirmingRegistration] = useState(false);
  const [registrationNotice, setRegistrationNotice] = useState<RegistrationNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const refreshInFlightRef = useRef(false);

  const loadSlots = useCallback(async (silent = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/public/slots", { cache: "no-store" });
      if (!response.ok) throw new Error("Slot refresh failed.");
      const payload = await response.json();
      setSlots(payload.slots || []);
    } catch {
      if (!silent) {
        setMessage({ kind: "error", text: "Impossible de charger les créneaux." });
      }
    } finally {
      refreshInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSlots();

    const refreshVisibleSlots = () => {
      if (document.visibilityState === "visible") void loadSlots(true);
    };
    const intervalId = window.setInterval(refreshVisibleSlots, SLOT_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshVisibleSlots);
    document.addEventListener("visibilitychange", refreshVisibleSlots);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshVisibleSlots);
      document.removeEventListener("visibilitychange", refreshVisibleSlots);
    };
  }, [loadSlots]);

  const selectedSlotIdSet = useMemo(() => new Set(selectedSlotIds), [selectedSlotIds]);
  const selectedSlot = useMemo(
    () => slots.find(slot => slot.slotDate === selectedDate) || slots.find(slot => selectedSlotIdSet.has(slot.id)) || null,
    [selectedDate, selectedSlotIdSet, slots]
  );
  const selectedSlots = useMemo(
    () => slots
      .filter(slot => selectedSlotIdSet.has(slot.id))
      .sort((a, b) => a.slotDate.localeCompare(b.slotDate)),
    [selectedSlotIdSet, slots]
  );
  const selectedSlotIsWaitlist = selectedSlot ? selectedSlot.placesTaken >= selectedSlot.capacity : false;
  const selectedDates = useMemo(
    () => new Set(selectedSlots.map(slot => slot.slotDate)),
    [selectedSlots]
  );
  const confirmedParticipants = selectedSlot?.participants.filter(participant => (
    participant.registrationStatus === "confirmed"
  )) || [];
  const waitlistParticipants = selectedSlot?.participants.filter(participant => (
    participant.registrationStatus === "waitlist"
  )) || [];

  const calendarSlots: SlotCalendarItem[] = slots.map(slot => ({
    id: slot.id,
    slotDate: slot.slotDate,
    placesTaken: slot.placesTaken,
    capacity: slot.capacity,
    waitlistCount: slot.waitlistCount,
  }));

  const toggleSlot = (date: string, slot: SlotCalendarItem | null) => {
    setSelectedDate(date);
    setMessage(null);
    if (!slot) return;
    setSelectedSlotIds(prev => (
      prev.includes(slot.id)
        ? prev.filter(slotId => slotId !== slot.id)
        : [...prev, slot.id]
    ));
  };

  const removeSelectedSlot = (slotId: string) => {
    setSelectedSlotIds(prev => prev.filter(id => id !== slotId));
    setMessage(null);
  };

  const requestRegistration = (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedSlotIds.length === 0 || busy) return;
    setConfirmingRegistration(true);
  };

  const register = async () => {
    if (selectedSlotIds.length === 0 || busy) return;

    setConfirmingRegistration(false);
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/public/slots/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotIds: selectedSlotIds, participantEmail }),
      });
      const payload = await response.json();

      if (!response.ok || (!payload.ok && !payload.partialOk)) {
        setMessage({ kind: "error", text: payload.message || "Inscription impossible." });
        return;
      }

      const results: BatchRegistrationResult[] = payload.results || [];
      const successes = results.filter(result => result.ok);
      const failures = results.filter(result => !result.ok);
      const waitlisted = successes.filter(result => result.registration?.registrationStatus === "waitlist").length;
      const outlookIssues = successes.filter(result => {
        const status = result.outlookInvitation?.status;
        return status === "failed" || status === "not_configured";
      }).length;
      const invitationNote = outlookIssues > 0
        ? " Certaines invitations Outlook n'ont pas pu être envoyées automatiquement."
        : " Les invitations Outlook ont été déclenchées en une seule fois.";
      const waitlistNote = waitlisted > 0 ? ` ${waitlisted} créneau(x) en liste d'attente.` : "";
      const failureNote = failures.length > 0
        ? ` ${failures.length} créneau(x) non réservé(s) : ${failures.map(result => result.message || "erreur").join(" ; ")}`
        : "";
      const selectedSlotsById = new Map(selectedSlots.map(slot => [slot.id, slot]));
      const registeredDates = successes.flatMap(result => {
        const slot = selectedSlotsById.get(result.slotId);
        if (!slot) return [];
        return [{
          slotDate: slot.slotDate,
          registrationStatus: result.registration?.registrationStatus === "waitlist"
            ? "waitlist" as const
            : "confirmed" as const,
        }];
      });
      const resultNote = `${successes.length} créneau(x) réservé(s).${waitlistNote}${invitationNote}${failureNote}`;

      setMessage({
        kind: failures.length > 0 || outlookIssues > 0 ? "error" : "ok",
        text: resultNote,
      });
      setRegistrationNotice({
        dates: registeredDates,
        hasWarning: failures.length > 0 || outlookIssues > 0,
        note: resultNote,
      });

      if (failures.length === 0) {
        setParticipantEmail("");
        setSelectedSlotIds([]);
        setSelectedDate(null);
      } else {
        setSelectedSlotIds(failures.map(result => result.slotId));
      }
      await loadSlots();
    } catch {
      setMessage({ kind: "error", text: "Erreur lors de l'inscription." });
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
          <p className="mb-4 text-sm font-medium text-[var(--ink)]">
            Cliquez sur un ou plusieurs créneaux successivement pour les ajouter à votre sélection. Entrez ensuite votre email une seule fois, puis validez : toutes les réservations seront envoyées ensemble.
          </p>
          {loading ? (
            <div className="p-8 text-center text-[var(--mid)]">Chargement des créneaux...</div>
          ) : (
            <SlotCalendar
              slots={calendarSlots}
              selectedDate={selectedDate}
              selectedDates={selectedDates}
              onSelectDate={toggleSlot}
            />
          )}
        </div>

        <div className={panelClass}>
          {selectedSlots.length === 0 && !selectedDate && (
            <div className="text-sm text-[var(--mid)]">Sélectionnez un ou plusieurs créneaux ouverts.</div>
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
                  {selectedSlot.waitlistCount > 0 && (
                    <span className="rounded-full border border-[rgba(238,140,0,.28)] bg-[rgba(238,140,0,.10)] px-3 py-1 font-semibold text-[var(--accent)]">
                      {selectedSlot.waitlistCount} en liste d&apos;attente
                    </span>
                  )}
                  <span className="rounded-full border border-[var(--border)] bg-[var(--paper2)] px-3 py-1 font-semibold">
                    {SLOT_TIME_LABEL}
                  </span>
                </div>
              </div>

              {selectedSlots.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-bold text-[var(--ink)]">Créneaux sélectionnés</div>
                  <ul className="grid gap-1.5 text-sm text-[var(--ink)]">
                    {selectedSlots.map(slot => (
                      <li key={slot.id} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--paper2)] px-3 py-2">
                        <span>{formatSlotDateLong(slot.slotDate)}</span>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--mid)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                          onClick={() => removeSelectedSlot(slot.id)}
                          aria-label={`Retirer ${formatSlotDateLong(slot.slotDate)}`}
                        >
                          <FiX />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="mb-2 text-sm font-bold text-[var(--ink)]">Inscrits sur le créneau affiché</div>
                {confirmedParticipants.length === 0 ? (
                  <div className="text-sm text-[var(--mid)]">Aucun inscrit pour le moment.</div>
                ) : (
                  <ul className="grid gap-1.5 text-sm text-[var(--ink)]">
                    {confirmedParticipants.map(participant => (
                      <li key={participant.id} className="rounded-lg bg-[var(--paper2)] px-3 py-2">
                        {participant.participantName}
                      </li>
                    ))}
                  </ul>
                )}
                {waitlistParticipants.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-2 text-xs font-bold uppercase text-[var(--mid)]">Liste d&apos;attente</div>
                    <ul className="grid gap-1.5 text-sm text-[var(--ink)]">
                      {waitlistParticipants.map(participant => (
                        <li key={participant.id} className="rounded-lg border border-[rgba(238,140,0,.22)] bg-[rgba(238,140,0,.08)] px-3 py-2">
                          {participant.participantName}
                        </li>
                      ))}
                    </ul>
                  </div>
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

              {selectedSlotIsWaitlist && (
                <div className="rounded-lg border border-[rgba(238,140,0,.22)] bg-[rgba(238,140,0,.08)] px-3 py-2 text-sm font-medium text-[var(--ink)]">
                  Le créneau affiché est complet. Vous pouvez vous inscrire en liste d&apos;attente ; l&apos;invitation Outlook sera envoyée en provisoire.
                </div>
              )}

              <form className="space-y-3" onSubmit={requestRegistration}>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-[var(--mid)]">Email</label>
                  <input
                    type="email"
                    value={participantEmail}
                    onChange={(event) => setParticipantEmail(event.target.value)}
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 outline-none focus:border-[var(--primary)]"
                    placeholder="prenom.nom@ifpc.eu"
                  />
                </div>
                <Button type="submit" disabled={busy || selectedSlots.length === 0}>
                  <FiUserPlus /> {selectedSlots.length > 1 ? `Réserver ${selectedSlots.length} créneaux` : selectedSlotIsWaitlist ? "Rejoindre la liste d'attente" : "Réserver ce créneau"}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      {confirmingRegistration && (
        <ConfirmModal
          title="Confirmer votre inscription"
          message={(
            <div className="space-y-3">
              <p>
                Vous allez vous inscrire avec l&apos;adresse <strong>{participantEmail}</strong> aux dates suivantes :
              </p>
              <ul className="grid gap-2">
                {selectedSlots.map(slot => (
                  <li key={slot.id} className="rounded-lg border border-[var(--border)] bg-[var(--paper2)] px-3 py-2 font-semibold text-[var(--ink)]">
                    {formatSlotDateLong(slot.slotDate)} · {SLOT_TIME_LABEL}
                    {slot.placesTaken >= slot.capacity && (
                      <span className="mt-1 block text-xs font-medium text-[var(--accent)]">
                        Inscription en liste d&apos;attente
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p>Souhaitez-vous confirmer cette inscription ?</p>
            </div>
          )}
          confirmLabel="Confirmer l'inscription"
          cancelLabel="Annuler"
          onConfirm={() => void register()}
          onCancel={() => setConfirmingRegistration(false)}
        />
      )}

      {registrationNotice && (
        <ConfirmModal
          title={registrationNotice.dates.length > 1 ? "Inscriptions enregistrées" : "Inscription enregistrée"}
          message={(
            <div className="space-y-3">
              {registrationNotice.dates.length > 0 && (
                <ul className="grid gap-2">
                  {registrationNotice.dates.map(({ slotDate, registrationStatus }) => (
                    <li key={slotDate} className="rounded-lg border border-[var(--border)] bg-[var(--paper2)] px-3 py-2 font-semibold text-[var(--ink)]">
                      {formatSlotDateLong(slotDate)} · {SLOT_TIME_LABEL}
                      <span className={`mt-1 block text-xs font-medium ${
                        registrationStatus === "waitlist" ? "text-[var(--accent)]" : "text-[var(--primary)]"
                      }`}>
                        {registrationStatus === "waitlist" ? "Liste d'attente" : "Inscription confirmée"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p>{registrationNotice.note}</p>
            </div>
          )}
          tone={registrationNotice.hasWarning ? "warn" : "default"}
          confirmLabel="OK"
          confirmVariant={registrationNotice.hasWarning ? "secondary" : "ok"}
          onConfirm={() => setRegistrationNotice(null)}
          onCancel={() => setRegistrationNotice(null)}
        />
      )}
    </section>
  );
};
