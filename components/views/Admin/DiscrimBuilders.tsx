"use client";
import React, { useState } from "react";
import { Chip, SampleToggle, ChipPool, DropSlot } from "./ClassementBuilder";
import type { Product } from "../../../types";

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
      <div className="builder-section-label">ÉCHANTILLONS DU TEST (exactement 3) — cliquez pour sélectionner</div>
      <SampleToggle products={products} selected={codes} onChange={onChangeCodes} max={3} />
      {codes.length === 3 && (
        <>
          <div className="builder-section-label mt-4">ÉCHANTILLON DIFFÉRENT (réponse correcte)</div>
          <div className="chip-pool">
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
      <div className="duo-trio-zones">
        <DropSlot label="Référence A" code={refA} accent="var(--ok)" onDrop={(c) => assign("a", c)} onRemove={() => update(null, refB, test)} />
        <DropSlot label="Référence B" code={refB} accent="var(--ok)" onDrop={(c) => assign("b", c)} onRemove={() => update(refA, null, test)} />
        <DropSlot label="Échantillon test" code={test} accent="var(--accent)" onDrop={(c) => assign("test", c)} onRemove={() => update(refA, refB, null)} />
      </div>
      {refA && refB && (
        <>
          <div className="builder-section-label mt-4">RÉPONSE CORRECTE — le verre test est identique à :</div>
          <div className="chip-pool">
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
  // Parse correctAnswer string "X:A,Y:non-A" → {X:'A', Y:'non-A'}
  const parseAnswer = (s: string): Record<string, string> => {
    if (!s) return {};
    return Object.fromEntries(s.split(",").map(p => p.split(":")).filter(a => a.length === 2));
  };
  const serializeAnswer = (obj: Record<string, string>) =>
    Object.entries(obj).map(([k, v]) => `${k}:${v}`).join(",");

  const assignment = parseAnswer(correctAnswer);
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
    onChangeCorrect(serializeAnswer(newAss));
  };

  // Assign to a zone
  const assignZone = (code: string, zone: "A" | "non-A" | null) => {
    // Ensure it's in codes
    const newCodes = codes.includes(code) ? codes : [...codes, code];
    const newAss = { ...assignment };
    if (zone === null) delete newAss[code];
    else newAss[code] = zone;
    onChangeCodes(newCodes);
    onChangeCorrect(serializeAnswer(newAss));
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
      onChangeCorrect(serializeAnswer(newAss));
    }
    setOverPool(false);
  };

  const [overRef, setOverRef] = useState(false);

  return (
    <div>
      {/* Reference sample */}
      <div className="builder-section-label">ÉCHANTILLON DE RÉFÉRENCE (A) — glissez l&apos;échantillon servant de référence</div>
      <div
        className={`drop-slot${overRef ? " drag-over" : ""}${refCode ? " filled" : ""} max-w-[200px] mb-4`}
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
            const parsed = parseAnswer(typeof correctAnswer === "string" ? correctAnswer : "");
            delete parsed[c];
            onChangeCorrect(serializeAnswer(parsed));
            onChangeRef(c);
          }
          setOverRef(false);
        }}
      >
        <div className="drop-slot-label text-[var(--accent)]">Référence A</div>
        {refCode
          ? <Chip code={refCode} active removable onRemove={() => {
              // Put refCode back into codes when removed as reference
              if (!codes.includes(refCode)) onChangeCodes([...codes, refCode]);
              onChangeRef("");
            }} />
          : <span className="drop-slot-hint">Glisser ici</span>}
      </div>

      {/* Products pool (not yet in test) */}
      {pool.length > 0 && (
        <div className="chip-pool-section">
          <span className="pool-hint">Glissez les échantillons dans les zones A ou non-A pour les inclure dans le test</span>
          <div className="chip-pool">
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
          className={`anona-unassigned${overPool ? " drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOverPool(true); }}
          onDragLeave={() => setOverPool(false)}
          onDrop={handleDropPool}
        >
          <span className="pool-hint">Non classés — glissez dans A ou non-A</span>
          <div className="chip-pool">
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
      <div className="anona-zones-admin">
        {/* Zone A */}
        <div
          className={`anona-zone-admin zone-a${overA ? " drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOverA(true); }}
          onDragLeave={() => setOverA(false)}
          onDrop={(e) => handleDropZone(e, "A")}
        >
          <div className="anona-zone-label">A — identique à la référence</div>
          <div className="chip-pool">
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
            {zoneA.length === 0 && <span className="drop-slot-hint">Glisser ici</span>}
          </div>
        </div>

        {/* Zone non-A */}
        <div
          className={`anona-zone-admin zone-nona${overNonA ? " drag-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOverNonA(true); }}
          onDragLeave={() => setOverNonA(false)}
          onDrop={(e) => handleDropZone(e, "non-A")}
        >
          <div className="anona-zone-label">non-A — différent de la référence</div>
          <div className="chip-pool">
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
            {zoneNonA.length === 0 && <span className="drop-slot-hint">Glisser ici</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
