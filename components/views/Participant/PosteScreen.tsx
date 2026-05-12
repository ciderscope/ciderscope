"use client";
import React from "react";
import { FiArrowLeft } from "react-icons/fi";
import { Button } from "../../ui/Button";
import { PosteDay } from "../../../types";

interface PosteScreenProps {
  onGoBack: () => void;
  takenPostes: Record<string, string>;
  onSelectPoste: (day: PosteDay, num: number) => void;
  cj: string;
}

export const PosteScreen = ({ onGoBack, takenPostes, onSelectPoste, cj }: PosteScreenProps) => {
  const days: PosteDay[] = ["mardi", "jeudi"];
  const numbers = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="mx-auto my-8 max-w-[720px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] px-5 py-[26px] shadow-[var(--shadow)] max-[480px]:mx-2 max-[480px]:my-3.5 max-[480px]:px-3.5 max-[480px]:py-[18px]">
      <h2 className="mb-1 text-2xl font-bold tracking-normal">Votre poste</h2>
      <p className="m-0 text-sm text-[var(--mid)]">
        Sélectionnez le numéro indiqué sur votre feuille de service.
      </p>
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] md:grid-cols-2">
        {days.map(d => (
          <div key={d} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper2)] p-3.5">
            <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-[0.06em] text-[var(--primary)]">{d.charAt(0).toUpperCase() + d.slice(1)}</h3>
            <div className="grid grid-cols-2 gap-2">
              {numbers.map(n => {
                const key = `${d}-${n}`;
                const owner = takenPostes[key];
                const taken = !!owner && owner !== cj;
                const mine = owner === cj;
                return (
                  <button
                    key={n}
                    type="button"
                    className={[
                      "flex min-h-14 flex-col items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)] px-2.5 py-3.5 font-[inherit] text-[var(--ink)] transition-all hover:-translate-y-px hover:border-[var(--primary)] hover:bg-[rgba(98,141,23,.06)] hover:text-[var(--primary)] disabled:translate-y-0",
                      taken ? "cursor-not-allowed border-dashed bg-[var(--paper3)] text-[var(--mid)] opacity-55" : "",
                      mine ? "border-[var(--primary)] bg-[rgba(98,141,23,.10)] text-[var(--primary)]" : "",
                    ].join(" ")}
                    onClick={() => !taken && onSelectPoste(d, n)}
                    disabled={taken}
                    title={taken ? `Pris par ${owner}` : `Poste ${n}`}
                  >
                    <span className="text-[22px] font-extrabold leading-none">{n}</span>
                    {taken && <span className="mt-1 max-w-full truncate font-mono text-[11px] text-[var(--mid)]">{owner}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-4" onClick={onGoBack}><FiArrowLeft /> Retour</Button>
    </div>
  );
};
