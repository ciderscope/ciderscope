"use client";
import React from "react";
import { FiArrowRight, FiSettings, FiUsers } from "react-icons/fi";

interface HomeScreenProps {
  onSelectParticipant: () => void;
  onSelectAdmin: () => void;
}

const tileClass = (color: "primary" | "accent") => [
  "group relative grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-5 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--paper)] px-[26px] py-7 text-left font-[inherit] text-[inherit] shadow-[var(--shadow)] transition-[border-color,box-shadow,transform] duration-200 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[var(--tile-color)] before:transition-[width] before:duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(30,46,46,.09)] hover:before:w-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--tile-color)]",
  color === "primary" ? "[--tile-color:var(--primary)]" : "[--tile-color:var(--accent)]",
].join(" ");

export const HomeScreen = ({ onSelectParticipant, onSelectAdmin }: HomeScreenProps) => (
  <div className="mx-auto flex max-w-[min(94%,1080px)] flex-col items-center px-7 py-14 text-center max-[480px]:px-3.5 max-[480px]:py-6">
    <div className="mb-12">
      <h1 className="mb-3.5 text-[clamp(44px,7vw,80px)] font-extrabold leading-[1.02] tracking-normal text-[var(--ink)] max-[480px]:text-3xl">
        Cider<span className="text-[var(--accent)]">Scope</span>
      </h1>
      <p className="font-mono text-[15px] tracking-[0.02em] text-[var(--mid)]">Plateforme d&apos;analyse sensorielle&nbsp;- IFPC</p>
    </div>

    <div className="grid w-full max-w-[880px] grid-cols-1 gap-5 md:grid-cols-2">
      <button
        type="button"
        className={tileClass("primary")}
        onClick={onSelectParticipant}
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--tile-color)_12%,var(--paper2))] text-[var(--tile-color)]"><FiUsers size={32} /></span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-xl font-bold tracking-normal text-[var(--ink)]">Participant</span>
          <span className="text-[13px] leading-snug text-[var(--mid)]">Rejoindre une séance et noter les échantillons</span>
        </span>
        <span className="flex text-[var(--mid2)] transition-[color,transform] duration-200 group-hover:translate-x-[3px] group-hover:text-[var(--tile-color)]"><FiArrowRight size={20} /></span>
      </button>

      <button
        type="button"
        className={tileClass("accent")}
        onClick={onSelectAdmin}
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--tile-color)_12%,var(--paper2))] text-[var(--tile-color)]"><FiSettings size={32} /></span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-xl font-bold tracking-normal text-[var(--ink)]">Admin</span>
          <span className="text-[13px] leading-snug text-[var(--mid)]">Configurer les séances et consulter l&apos;analyse</span>
        </span>
        <span className="flex text-[var(--mid2)] transition-[color,transform] duration-200 group-hover:translate-x-[3px] group-hover:text-[var(--tile-color)]"><FiArrowRight size={20} /></span>
      </button>
    </div>
  </div>
);
