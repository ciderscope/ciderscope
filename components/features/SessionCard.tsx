import React from 'react';

interface SessionCardProps {
  name: string;
  date: string;
  jurorCount: number;
  onClick: () => void;
  productCount?: number;
  questionCount?: number;
}

const countBadgeClass = "inline-flex items-baseline gap-1.5 rounded-lg bg-[var(--paper2)] px-3 py-2 text-[13px] leading-none text-[var(--mid)] max-[480px]:px-2.5 max-[480px]:py-[7px] max-[480px]:text-xs";

export const SessionCard = ({ name, date, jurorCount, onClick, productCount = 0, questionCount = 0 }: SessionCardProps) => (
  <div
    className="mb-3 cursor-pointer rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)] p-[22px] text-left shadow-[var(--shadow)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[rgba(30,46,46,.25)] hover:shadow-[0_6px_24px_rgba(30,46,46,.09)] max-[480px]:px-3.5 max-[480px]:py-4"
    onClick={onClick}
  >
    <h3 className="mb-1 text-lg font-bold leading-tight text-[var(--ink)] max-[480px]:text-[16.5px]">{name}</h3>
    <div className="font-mono text-[13px] text-[var(--mid)]">{date}</div>
    <div className="mt-4 flex flex-wrap gap-2 max-[480px]:gap-1.5">
      <div className={countBadgeClass}>
        <strong className="text-xl font-bold tracking-normal text-[var(--ink)] max-[480px]:text-lg">{productCount}</strong>
        <span>{productCount > 1 ? "échantillons" : "échantillon"}</span>
      </div>
      <div className={countBadgeClass}>
        <strong className="text-xl font-bold tracking-normal text-[var(--ink)] max-[480px]:text-lg">{questionCount}</strong>
        <span>{questionCount > 1 ? "questions" : "question"}</span>
      </div>
      <div className={`${countBadgeClass} bg-[color-mix(in_srgb,var(--accent)_12%,var(--paper2))] text-[color-mix(in_srgb,var(--accent)_70%,var(--ink))]`} title="Participants ayant répondu">
        <strong className="text-xl font-bold tracking-normal text-[var(--accent)] max-[480px]:text-lg">{jurorCount}</strong>
        <span>{jurorCount > 1 ? "participants" : "participant"}</span>
      </div>
    </div>
  </div>
);
