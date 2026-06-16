"use client";

import React, { useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { getMonthCalendarDays, monthLabel } from "../../lib/slots/dates";

export type SlotCalendarItem = {
  id: string;
  slotDate: string;
  placesTaken: number;
  capacity: number;
};

type SlotCalendarProps = {
  slots: SlotCalendarItem[];
  selectedDate?: string | null;
  onSelectDate: (date: string, slot: SlotCalendarItem | null) => void;
};

const dayLabels = ["L", "M", "M", "J", "V", "S", "D"];

const cellClass = (state: "available" | "full" | "empty", selected: boolean, inMonth: boolean) => [
  "relative flex aspect-square min-h-14 w-full flex-col items-start justify-between rounded-lg border p-2 text-left transition-[border-color,box-shadow,transform,background] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
  selected ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--paper)]" : "",
  inMonth ? "opacity-100" : "opacity-40",
  state === "available" ? "border-[rgba(98,141,23,.28)] bg-[rgba(98,141,23,.11)] text-[var(--ink)] hover:border-[var(--primary)]" : "",
  state === "full" ? "border-[rgba(198,40,40,.25)] bg-[rgba(198,40,40,.10)] text-[var(--ink)] hover:border-[var(--danger)]" : "",
  state === "empty" ? "border-[var(--border)] bg-[var(--paper2)] text-[var(--mid)] hover:border-[var(--border-strong)]" : "",
].filter(Boolean).join(" ");

export const SlotCalendar = ({ slots, selectedDate, onSelectDate }: SlotCalendarProps) => {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(() => ({
    year: today.getFullYear(),
    monthIndex: today.getMonth(),
  }));

  const slotsByDate = useMemo(() => {
    return new Map(slots.map(slot => [slot.slotDate, slot]));
  }, [slots]);

  const days = useMemo(
    () => getMonthCalendarDays(visibleMonth.year, visibleMonth.monthIndex),
    [visibleMonth]
  );

  const moveMonth = (delta: number) => {
    setVisibleMonth(prev => {
      const next = new Date(prev.year, prev.monthIndex + delta, 1);
      return { year: next.getFullYear(), monthIndex: next.getMonth() };
    });
  };

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--paper)] text-[var(--mid)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
          onClick={() => moveMonth(-1)}
          aria-label="Mois précédent"
          title="Mois précédent"
        >
          <FiChevronLeft />
        </button>
        <div className="flex-1 text-center text-sm font-bold capitalize text-[var(--ink)]">
          {monthLabel(visibleMonth.year, visibleMonth.monthIndex)}
        </div>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--paper)] text-[var(--mid)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
          onClick={() => moveMonth(1)}
          aria-label="Mois suivant"
          title="Mois suivant"
        >
          <FiChevronRight />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-[var(--mid)]">
        {dayLabels.map((label, index) => <div key={`${label}-${index}`}>{label}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const slot = slotsByDate.get(day.date) || null;
          const state = slot ? (slot.placesTaken >= slot.capacity ? "full" : "available") : "empty";
          return (
            <button
              type="button"
              key={day.date}
              className={cellClass(state, selectedDate === day.date, day.inMonth)}
              onClick={() => onSelectDate(day.date, slot)}
              aria-label={slot ? `${day.date}, ${slot.placesTaken} places prises sur ${slot.capacity}` : `${day.date}, pas de créneau`}
            >
              <span className="text-sm font-bold leading-none">{day.day}</span>
              {slot && (
                <span className="self-end rounded-full bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--mid)] shadow-[var(--shadow)]">
                  {slot.placesTaken}/{slot.capacity}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-[var(--mid)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" /> ouvert</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" /> complet</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--paper3)]" /> sans créneau</span>
      </div>
    </div>
  );
};
