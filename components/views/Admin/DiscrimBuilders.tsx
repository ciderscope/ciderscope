"use client";
import React, { useState } from "react";
import { Chip, SampleToggle, ChipPool, DropSlot } from "./ClassementBuilder";
import type { Product } from "../../../types";
import { parseANonAAnswer, serializeANonAAnswer } from "../../../lib/answers";
import {
  builderSectionLabelClass,
  chipPoolClass,
  chipPoolSectionClass,
  dropSlotClass,
  dropSlotHintClass,
  dropSlotLabelClass,
  poolHintClass,
} from "./utils";

const anonaUnassignedClass = (dragOver: boolean) => [
  "mb-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--paper)] px-3.5 py-[11px] transition-colors duration-100",
  dragOver ? "bg-[var(--paper2)]" : "",
].join(" ");
const anonaZonesAdminClass = "mt-3 flex flex-wrap gap-3.5 max-[720px]:flex-col max-[480px]:gap-2.5";
const anonaZoneAdminClass = (zone: "a" | "nona", dragOver: boolean) => [
  "min-h-[110px] flex-1 rounded-lg border-[1.5px] border-dashed bg-[var(--paper)] p-[17px] transition-all duration-150 max-[480px]:min-w-0",
  zone === "a" ? "border-[rgba(59,107,51,.3)]" : "border-[rgba(168,50,40,.25)]",
  dragOver && zone === "a" ? "border-solid border-[var(--ok)] bg-[rgba(59,107,51,.05)]" : "",
  dragOver && zone === "nona" ? "border-solid border-[var(--danger)] bg-[rgba(168,50,40,.04)]" : "",
].join(" ");
const anonaZoneLabelClass = (zone: "a" | "nona") => [
  "mb-2.5 flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[.4px]",
  zone === "a" ? "text-[var(--ok)]" : "text-[var(--danger)]",
].join(" ");

interface BuilderProps {
  products: Product[];
  codes: string[];
  correctAnswer: string;
  onChangeCodes: (c: string[]) => void;
  onChangeCorrect: (v: string) => void;
}

export function TriangulaireBuilder({ products, codes, correctAnswer, onChangeCodes, onChangeCorrect }: BuilderProps) {
  return (
    <div>
      <div className={builderSectionLabelClass}>ÉCHANTILLONS DU TEST (exactement 3) — cliquez pour sélectionner</div>
      <SampleToggle products={products} selected={codes} onChange={onChangeCodes} max={3} />
      {codes.length === 3 && (
        <>
          <div className={`${builderSectionLabelClass} mt-4`}>ÉCHANTILLON DIFFÉRENT (réponse correcte)</div>
          <div className={chipPoolClass()}>
            {codes.map(c => (
              <Chip key={c} code={c} active={correctAnswer === c} onClick={() => onChangeCorrect(c)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function DuoTrioBuilder({ products, codes, correctAnswer, onChangeCodes, onChangeCorrect }: BuilderProps) {
  const [refA, refB, test] = [codes[0] ?? null, codes[1] ?? null, codes[2] ?? null];

  const update = (a: string | null, b: string | null, t: string | null) => {
    const next = [a, b, t].filter(Boolean) as string[];
    onChangeCodes(next);
    // Reset correct answer if it's no longer one of the refs
    if (correctAnswer && correctAnswer !== a && correctAnswer !== b) onChangeCorrect("");
  };

  const assign = (slot: "a" | "b" | "test", code: string) => {
    // Remove code from other slots first
    const na = slot === "a" ? code : (refA === code ? null : refA);
    const nb = slot === "b" ? code : (refB === code ? null : refB);
    const nt = slot === "test" ? code : (test === code ? null : test);
    update(na, nb, nt);
  };

  const assigned = [refA, refB, test].filter(Boolean) as string[];
  const pool = products.filter(p => !assigned.includes(p.code));

  return (
    <div>
      <ChipPool codes={pool.map(p => p.code)} label="Glissez les échantillons dans les cases ci-dessous" />
      <div className="mt-3 flex flex-wrap gap-3 max-[720px]:flex-col max-[480px]:gap-2.5">
        <DropSlot label="Référence A" code={refA} accent="var(--ok)" onDrop={(c) => assign("a", c)} onRemove={() => update(null, refB, test)} />
        <DropSlot label="Référence B" code={refB} accent="var(--ok)" onDrop={(c) => assign("b", c)} onRemove={() => update(refA, null, test)} />
        <DropSlot label="Échantillon test" code={test} accent="var(--accent)" onDrop={(c) => assign("test", c)} onRemove={() => update(refA, refB, null)} />
      </div>
      {refA && refB && (
        <>
          <div className={`${builderSectionLabelClass} mt-4`}>RÉPONSE CORRECTE — le verre test est identique à :</div>
          <div className={chipPoolClass()}>
            {[refA, refB].map(ref => (
              <Chip key={ref} code={ref} active={correctAnswer === ref} onClick={() => onChangeCorrect(ref)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ANonABuilder({ products, codes, correctAnswer, refCode, onChangeCodes, onChangeCorrect, onChangeRef }: {
  products: Product[];
  codes: string[];
  correctAnswer: string;
  refCode: string;
  onChangeCodes: (c: string[]) => void;
  onChangeCorrect: (v: string) => void;
  onChangeRef: (v: string) => void;
}) {
  const assignment = parseANonAAnswer(correctAnswer);
  const zoneA = codes.filter(c => assignment[c] === "A");
  const zoneNonA = codes.filter(c => assignment[c] === "non-A");
  const unassigned = codes.filter(c => !assignment[c]);
  // Exclure les codes déjà dans le test ET l'échantillon de référence
  const pool = products.filter(p => !codes.includes(p.code) && p.code !== refCode);

  const [overA, setOverA] = useState(false);
  const [overNonA, setOverNonA] = useState(false);
  const [overPool, setOverPool] = useState(false);

  // Add a product to the test (from products pool → codes)
  const addToTest = (code: string) => {
    if (!codes.includes(code)) onChangeCodes([...codes, code]);
  };

  // Remove from test entirely
  const removeFromTest = (code: string) => {
    const newCodes = codes.filter(c => c !== code);
    const newAss = { ...assignment };
    delete newAss[code];
    onChangeCodes(newCodes);
    onChangeCorrect(serializeANonAAnswer(newAss));
  };

  // Assign to a zone
  const assignZone = (code: string, zone: "A" | "non-A" | null) => {
    // Ensure it's in codes
    const newCodes = codes.includes(code) ? codes : [...codes, code];
    const newAss = { ...assignment };
    if (zone === null) delete newAss[code];
    else newAss[code] = zone;
    onChangeCodes(newCodes);
    onChangeCorrect(serializeANonAAnswer(newAss));
  };

  const handleDropZone = (e: React.DragEvent, zone: "A" | "non-A") => {
    e.preventDefault();
    const code = e.dataTransfer.getData("chip-code");
    if (code) assignZone(code, zone);
    setOverA(false); setOverNonA(false);
  };

  const handleDropPool = (e: React.DragEvent) => {
    e.preventDefault();
    const code = e.dataTransfer.getData("chip-code");
    if (code) {
      // Remove from zone but keep in codes (move to unassigned)
      const newAss = { ...assignment };
      delete newAss[code];
      // If it was from the products pool, also add to codes
      const newCodes = codes.includes(code) ? codes : [...codes, code];
      onChangeCodes(newCodes);
      onChangeCorrect(serializeANonAAnswer(newAss));
    }
    setOverPool(false);
  };

  const [overRef, setOverRef] = useState(false);

  return (
    <div>
      {/* Reference sample */}
      <div className={builderSectionLabelClass}>ÉCHANTILLON DE RÉFÉRENCE (A) — glissez l&apos;échantillon servant de référence</div>
      <div
        className={dropSlotClass(overRef, !!refCode, "mb-4 max-w-[200px]")}
        onDragOver={(e) => { e.preventDefault(); setOverRef(true); }}
        onDragLeave={() => setOverRef(false)}
        onDrop={(e) => {
          e.preventDefault();
          const c = e.dataTransfer.getData("chip-code");
          if (c) {
            // Remove from test codes if present, add previous ref back to codes
            const newCodes = codes.filter(x => x !== c);
            if (refCode && refCode !== c && !newCodes.includes(refCode)) newCodes.push(refCode);
            onChangeCodes(newCodes);
            // Also clean correctAnswer from new ref if needed
            const parsed = parseANonAAnswer(correctAnswer);
            delete parsed[c];
            onChangeCorrect(serializeANonAAnswer(parsed));
            onChangeRef(c);
          }
          setOverRef(false);
        }}
      >
        <div className={`${dropSlotLabelClass} text-[var(--accent)]`}>Référence A</div>
        {refCode
          ? <Chip code={refCode} active removable onRemove={() => {
              // Put refCode back into codes when removed as reference
              if (!codes.includes(refCode)) onChangeCodes([...codes, refCode]);
              onChangeRef("");
            }} />
          : <span className={dropSlotHintClass}>Glisser ici</span>}
      </div>

      {/* Products pool (not yet in test) */}
      {pool.length > 0 && (
        <div className={chipPoolSectionClass}>
          <span className={poolHintClass}>Glissez les échantillons dans les zones A ou non-A pour les inclure dans le test</span>
          <div className={chipPoolClass()}>
            {pool.map(p => (
              <Chip
                key={p.code}
                code={p.code}
                onDragStart={(e) => { e.dataTransfer.setData("chip-code", p.code); addToTest(p.code); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unassigned (in test but not yet classified) */}
      {unassigned.length > 0 && (
        <div
          className={anonaUnassignedClass(overPool)}
          onDragOver={(e) => { e.preventDefault(); setOverPool(true); }}
          onDragLeave={() => setOverPool(false)}
          onDrop={handleDropPool}
        >
          <span className={poolHintClass}>Non classés — glissez dans A ou non-A</span>
          <div className={chipPoolClass()}>
            {unassigned.map(code => (
              <Chip
                key={code}
                code={code}
                onDragStart={(e) => e.dataTransfer.setData("chip-code", code)}
                removable
                onRemove={() => removeFromTest(code)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Two classification zones */}
      <div className={anonaZonesAdminClass}>
        {/* Zone A */}
        <div
          className={anonaZoneAdminClass("a", overA)}
          onDragOver={(e) => { e.preventDefault(); setOverA(true); }}
          onDragLeave={() => setOverA(false)}
          onDrop={(e) => handleDropZone(e, "A")}
        >
          <div className={anonaZoneLabelClass("a")}>A — identique à la référence</div>
          <div className={chipPoolClass()}>
            {zoneA.map(code => (
              <Chip
                key={code}
                code={code}
                active
                onDragStart={(e) => e.dataTransfer.setData("chip-code", code)}
                removable
                onRemove={() => removeFromTest(code)}
              />
            ))}
            {zoneA.length === 0 && <span className={dropSlotHintClass}>Glisser ici</span>}
          </div>
        </div>

        {/* Zone non-A */}
        <div
          className={anonaZoneAdminClass("nona", overNonA)}
          onDragOver={(e) => { e.preventDefault(); setOverNonA(true); }}
          onDragLeave={() => setOverNonA(false)}
          onDrop={(e) => handleDropZone(e, "non-A")}
        >
          <div className={anonaZoneLabelClass("nona")}>non-A — différent de la référence</div>
          <div className={chipPoolClass()}>
            {zoneNonA.map(code => (
              <Chip
                key={code}
                code={code}
                active
                onDragStart={(e) => e.dataTransfer.setData("chip-code", code)}
                removable
                onRemove={() => removeFromTest(code)}
              />
            ))}
            {zoneNonA.length === 0 && <span className={dropSlotHintClass}>Glisser ici</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
