"use client";
import { useState } from "react";
import { FiEdit2, FiCopy, FiX, FiCheck, FiArrowLeft, FiPlus } from "react-icons/fi";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Question, QuestionType, Product } from "../../types";

interface AdminViewProps {
  screen: "landing" | "jury" | "form" | "done" | "edit";
  sessions: any[];
  editCfg: any;
  curEditTab: string;
  editSessId: string | null;
  onNewSession: () => void;
  onEditSession: (id: string) => void;
  onToggleActive: (id: string) => void;
  onDuplicateSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onSetEditCfg: (cfg: any) => void;
  onSetEditTab: (tab: string) => void;
  onSaveEdit: () => void;
  onHome: () => void;
  buildCSVRows: (cfg: any, ans: any) => any[];
  downloadCSV: (rows: any[], filename: string) => void;
}

export const AdminView = ({
  screen, sessions, editCfg, curEditTab, editSessId,
  onNewSession, onEditSession, onToggleActive, onDuplicateSession, onDeleteSession,
  onSetEditCfg, onSetEditTab, onSaveEdit, onHome, buildCSVRows, downloadCSV
}: AdminViewProps) => {
  if (screen === "landing") {
    return (
      <div className="admin-shell">
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: "22px" }}>Séances</h2>
          <div style={{ flex: 1 }}></div>
          <Button size="sm" onClick={onNewSession}>+ Nouvelle</Button>
        </div>
        <div id="sessList">
          {sessions.length === 0 ? (
            <div className="no-session">Aucune séance.</div>
          ) : (
            sessions.map(s => (
              <div key={s.id} className="sess-list-card">
                <div>
                  <div className="name">{s.name}{s.active ? <Badge variant="active">ACTIVE</Badge> : <Badge variant="inactive">INACTIVE</Badge>}</div>
                  <div className="info">{s.date} · {s.jurorCount} jurys</div>
                </div>
                <div className="spacer"></div>
                <div className="actions">
                  {s.active
                    ? <Button variant="ghost" size="sm" onClick={() => onToggleActive(s.id)}>Désactiver</Button>
                    : <Button variant="ok" size="sm" onClick={() => onToggleActive(s.id)}>Activer</Button>}
                  <Button variant="secondary" size="sm" onClick={() => onEditSession(s.id)} title="Modifier"><FiEdit2 /></Button>
                  <Button variant="ghost" size="sm" onClick={() => onDuplicateSession(s.id)} title="Dupliquer"><FiCopy /></Button>
                  <Button variant="ghost" size="sm" style={{ color: "var(--danger)" }} onClick={() => onDeleteSession(s.id)} title="Supprimer"><FiX /></Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (screen === "edit" && editCfg) {
    return (
      <div className="admin-shell">
        <div className="admin-tabs">
          {["session", "questions", "présentation", "données"].map(t => (
            <div key={t} className={`admin-tab ${t === curEditTab ? "active" : ""}`} onClick={() => onSetEditTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>
        <div id="editContent">
          {curEditTab === "session" && (
            <>
              <Card title="Séance">
                <div className="field">
                  <label>NOM</label>
                  <input value={editCfg.name} onChange={(e) => onSetEditCfg({ ...editCfg, name: e.target.value })} />
                </div>
                <div className="field">
                  <label>DATE</label>
                  <input type="date" value={editCfg.date} onChange={(e) => onSetEditCfg({ ...editCfg, date: e.target.value })} />
                </div>
                <div className="field">
                  <label>ANIMATEUR</label>
                  <input value={editCfg.animateur || ""} onChange={(e) => onSetEditCfg({ ...editCfg, animateur: e.target.value })} />
                </div>
              </Card>
              <Card title="Échantillons">
                {editCfg.products.map((p: any, i: number) => (
                  <div key={i} className="flex" style={{ marginBottom: "8px", gap: "6px" }}>
                    <input
                      value={p.code}
                      onChange={(e) => {
                        const nl = [...editCfg.products]; nl[i].code = e.target.value;
                        onSetEditCfg({ ...editCfg, products: nl });
                      }}
                      style={{ width: "90px", border: "1px solid var(--border)", borderRadius: "7px", padding: "7px", fontFamily: "DM Mono, monospace", fontSize: "13px" }}
                    />
                    <input
                      value={p.label || ""}
                      placeholder="Description"
                      onChange={(e) => {
                        const nl = [...editCfg.products]; nl[i].label = e.target.value;
                        onSetEditCfg({ ...editCfg, products: nl });
                      }}
                      style={{ flex: 1, border: "1px solid var(--border)", borderRadius: "7px", padding: "7px", fontSize: "13px" }}
                    />
                    <Button variant="ghost" size="sm" style={{ color: "var(--danger)" }} onClick={() => {
                      onSetEditCfg({ ...editCfg, products: editCfg.products.filter((_: any, idx: number) => idx !== i) });
                    }}><FiX /></Button>
                  </div>
                ))}
                <div className="flex mt8">
                  <Button variant="ghost" size="sm" onClick={() => onSetEditCfg({ ...editCfg, products: [...editCfg.products, { code: String(Math.floor(Math.random() * 900) + 100), label: "" }] })}>
                    <FiPlus /> Échantillon
                  </Button>
                </div>
              </Card>
            </>
          )}
          {curEditTab === "questions" && (
            <QuestionBuilder editCfg={editCfg} onSetEditCfg={onSetEditCfg} />
          )}
          {curEditTab === "données" && (
            <Card title="Export des données">
              <Button onClick={() => {
                const all: any = {};
                const jl = JSON.parse(localStorage.getItem(`sp_j_${editSessId}`) || "[]");
                jl.forEach((n: string) => { all[n] = JSON.parse(localStorage.getItem(`sp_a_${editSessId}_${n}`) || "{}"); });
                downloadCSV(buildCSVRows(editCfg, all), editCfg.name);
              }}>Télécharger CSV</Button>
            </Card>
          )}
        </div>
        <div className="flex mt24" style={{ justifyContent: "flex-end" }}>
          <Button variant="ghost" size="sm" onClick={onHome}><FiArrowLeft /> Liste</Button>
          <Button variant="ok" onClick={onSaveEdit}><FiCheck /> Enregistrer</Button>
        </div>
      </div>
    );
  }

  return null;
};

// ─────────────────────────────────────────────
// Shared primitive: a draggable / clickable chip
// ─────────────────────────────────────────────
function Chip({ code, active, onClick, onDragStart, removable, onRemove }: {
  code: string;
  active?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  removable?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div
      className={`admin-chip${active ? " active" : ""}${onDragStart ? " draggable" : ""}`}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onClick}
      title={code}
    >
      <span>{code}</span>
      {removable && (
        <button className="chip-x" onClick={(e) => { e.stopPropagation(); onRemove?.(); }} type="button">
          <FiX size={10} />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Multi-select toggle from product list
// ─────────────────────────────────────────────
function SampleToggle({ products, selected, onChange, max }: {
  products: Product[];
  selected: string[];
  onChange: (codes: string[]) => void;
  max?: number;
}) {
  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter(c => c !== code));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, code]);
    }
  };
  return (
    <div className="chip-pool">
      {products.length === 0 && <span className="pool-hint">Ajoutez d&apos;abord des échantillons dans l&apos;onglet Session.</span>}
      {products.map(p => (
        <Chip key={p.code} code={p.code} active={selected.includes(p.code)} onClick={() => toggle(p.code)} />
      ))}
      {max && <span className="pool-hint">{selected.length}/{max} sélectionnés</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Drop zone (single slot)
// ─────────────────────────────────────────────
function DropSlot({ label, code, onDrop, onRemove, accent }: {
  label: string;
  code: string | null;
  onDrop: (code: string) => void;
  onRemove: () => void;
  accent?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop-slot${over ? " drag-over" : ""}${code ? " filled" : ""}`}
      style={accent ? { borderColor: over || code ? accent : undefined } as React.CSSProperties : undefined}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); const c = e.dataTransfer.getData("chip-code"); if (c) onDrop(c); setOver(false); }}
    >
      <div className="drop-slot-label" style={accent ? { color: accent } as React.CSSProperties : undefined}>{label}</div>
      {code
        ? <Chip code={code} active removable onRemove={onRemove} />
        : <span className="drop-slot-hint">Glisser ici</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Pool of draggable chips
// ─────────────────────────────────────────────
function ChipPool({ codes, label }: { codes: string[]; label?: string }) {
  if (codes.length === 0) return null;
  return (
    <div className="chip-pool-section">
      {label && <span className="pool-hint">{label}</span>}
      <div className="chip-pool">
        {codes.map(code => (
          <Chip
            key={code}
            code={code}
            onDragStart={(e) => e.dataTransfer.setData("chip-code", code)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Classement / Seuil builder
// ─────────────────────────────────────────────
function ClassementBuilder({ products, codes, correctOrder, onChangeCodes, onChangeOrder }: {
  products: Product[];
  codes: string[];
  correctOrder: string[];
  onChangeCodes: (c: string[]) => void;
  onChangeOrder: (o: string[]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // Sync correctOrder whenever codes changes
  const handleCodesChange = (newCodes: string[]) => {
    onChangeCodes(newCodes);
    // Remove from correctOrder any code that's no longer selected
    onChangeOrder(correctOrder.filter(c => newCodes.includes(c)));
  };

  const handleDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const next = [...correctOrder];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    onChangeOrder(next);
    setDragIdx(null); setOverIdx(null);
  };

  // codes not yet in correctOrder
  const unordered = codes.filter(c => !correctOrder.includes(c));

  return (
    <div>
      <div className="builder-section-label">ÉCHANTILLONS INCLUS — cliquez pour inclure / exclure</div>
      <SampleToggle products={products} selected={codes} onChange={handleCodesChange} />

      {codes.length > 0 && (
        <>
          <div className="builder-section-label" style={{ marginTop: "16px" }}>
            ORDRE CORRECT — glissez pour définir l&apos;ordre attendu (du meilleur au moins bon)
          </div>
          {unordered.length > 0 && (
            <ChipPool codes={unordered} label="Non encore classés — glissez-les dans la liste ci-dessous" />
          )}
          <div className="draggable-list admin-order-list">
            {correctOrder.filter(c => codes.includes(c)).map((code, i) => (
              <div
                key={code}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={`draggable-item${dragIdx === i ? " dragging" : ""}${overIdx === i && dragIdx !== i ? " drag-over" : ""}`}
              >
                <span className="drag-handle">&#8942;&#8942;</span>
                <span className="rank-pos">{i + 1}</span>
                <span className="rank-code">{code}</span>
                <button className="chip-x" style={{ marginLeft: "auto" }} onClick={() => onChangeOrder(correctOrder.filter(c => c !== code))} type="button">
                  <FiX size={11} />
                </button>
              </div>
            ))}
            {/* drop zone at bottom to add unordered */}
            {unordered.map(code => (
              <div
                key={code}
                className="draggable-item unordered"
                onClick={() => onChangeOrder([...correctOrder.filter(c => codes.includes(c)), code])}
              >
                <span className="drag-handle" style={{ opacity: 0.3 }}>&#8942;&#8942;</span>
                <span className="rank-pos" style={{ color: "var(--mid)" }}>—</span>
                <span className="rank-code" style={{ color: "var(--mid)" }}>{code}</span>
                <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--accent)", cursor: "pointer" }}>+ ajouter</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Triangulaire builder
// ─────────────────────────────────────────────
function TriangulaireBuilder({ products, codes, correctAnswer, onChangeCodes, onChangeCorrect }: {
  products: Product[];
  codes: string[];
  correctAnswer: string;
  onChangeCodes: (c: string[]) => void;
  onChangeCorrect: (v: string) => void;
}) {
  return (
    <div>
      <div className="builder-section-label">ÉCHANTILLONS DU TEST (exactement 3) — cliquez pour sélectionner</div>
      <SampleToggle products={products} selected={codes} onChange={onChangeCodes} max={3} />
      {codes.length === 3 && (
        <>
          <div className="builder-section-label" style={{ marginTop: "16px" }}>ÉCHANTILLON DIFFÉRENT (réponse correcte)</div>
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

// ─────────────────────────────────────────────
// Duo-trio builder (3 drop slots)
// ─────────────────────────────────────────────
function DuoTrioBuilder({ products, codes, correctAnswer, onChangeCodes, onChangeCorrect }: {
  products: Product[];
  codes: string[];
  correctAnswer: string;
  onChangeCodes: (c: string[]) => void;
  onChangeCorrect: (v: string) => void;
}) {
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
          <div className="builder-section-label" style={{ marginTop: "16px" }}>RÉPONSE CORRECTE — le verre test est identique à :</div>
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

// ─────────────────────────────────────────────
// A non-A builder (two drop zones)
// ─────────────────────────────────────────────
function ANonABuilder({ products, codes, correctAnswer, onChangeCodes, onChangeCorrect }: {
  products: Product[];
  codes: string[];
  correctAnswer: string;
  onChangeCodes: (c: string[]) => void;
  onChangeCorrect: (v: string) => void;
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
  const pool = products.filter(p => !codes.includes(p.code));

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

  return (
    <div>
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

// ─────────────────────────────────────────────
// QCM options list
// ─────────────────────────────────────────────
function QCMOptions({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  return (
    <div className="qcm-options-builder">
      {options.map((opt, i) => (
        <div key={i} className="qcm-option-row">
          <input
            value={opt}
            onChange={(e) => { const n = [...options]; n[i] = e.target.value; onChange(n); }}
            placeholder={`Option ${i + 1}`}
          />
          <button className="chip-x" onClick={() => onChange(options.filter((_, idx) => idx !== i))} type="button">
            <FiX />
          </button>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange([...options, ""])} style={{ marginTop: "6px" }}>
        <FiPlus /> Ajouter une option
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main question builder
// ─────────────────────────────────────────────
function QuestionBuilder({ editCfg, onSetEditCfg }: { editCfg: any; onSetEditCfg: any }) {
  const products: Product[] = editCfg.products || [];

  const addQuestion = (type: QuestionType) => {
    const id = "q" + Date.now();
    const allCodes = products.map(p => p.code);
    const newQ: Question = {
      id,
      type,
      label: type === "triangulaire" ? "Quel échantillon est différent des deux autres ?" : "Nouvelle question",
      scope: ["classement", "seuil", "triangulaire", "duo-trio", "a-non-a"].includes(type) ? "standalone" : "per-product",
    };
    if (type === "scale") { newQ.min = 0; newQ.max = 10; }
    if (type === "qcm") newQ.options = ["Excellent", "Bon", "Moyen", "Mauvais"];
    if (type === "triangulaire") newQ.codes = allCodes.slice(0, 3);
    if (type === "duo-trio") newQ.codes = allCodes.slice(0, 3);
    if (type === "a-non-a") { newQ.codes = allCodes; newQ.correctAnswer = ""; }
    if (type === "classement" || type === "seuil") { newQ.codes = allCodes; newQ.correctOrder = []; }
    onSetEditCfg({ ...editCfg, questions: [...editCfg.questions, newQ] });
  };

  const updateQ = (i: number, patch: Partial<Question>) => {
    const n = [...editCfg.questions];
    n[i] = { ...n[i], ...patch };
    onSetEditCfg({ ...editCfg, questions: n });
  };

  const TYPES: QuestionType[] = ["scale", "classement", "seuil", "text", "qcm", "triangulaire", "duo-trio", "a-non-a"];

  return (
    <div>
      {editCfg.questions.map((q: Question, i: number) => (
        <div key={q.id} className={`q-builder q-builder-${q.type}`}>
          <div className="q-builder-header">
            <span className="q-num">Q{i + 1}</span>
            <Badge variant="ns">{q.type}</Badge>
            <span style={{ flex: 1 }} />
            <button className="q-del" onClick={() => onSetEditCfg({ ...editCfg, questions: editCfg.questions.filter((_: any, idx: number) => idx !== i) })}>
              <FiX />
            </button>
          </div>

          {/* Libellé — always shown */}
          <div className="q-fields">
            <div className="field-wrap full">
              <label>LIBELLÉ</label>
              <input value={q.label} onChange={(e) => updateQ(i, { label: e.target.value })} />
            </div>
          </div>

          {/* Type-specific UI */}
          <div className="q-type-body">

            {q.type === "scale" && (
              <div className="q-fields">
                <div className="field-wrap"><label>MIN</label><input type="number" value={q.min ?? 0} onChange={(e) => updateQ(i, { min: +e.target.value })} /></div>
                <div className="field-wrap"><label>MAX</label><input type="number" value={q.max ?? 10} onChange={(e) => updateQ(i, { max: +e.target.value })} /></div>
                <div className="field-wrap"><label>LABEL MIN</label><input value={q.labelMin || ""} onChange={(e) => updateQ(i, { labelMin: e.target.value })} /></div>
                <div className="field-wrap"><label>LABEL MAX</label><input value={q.labelMax || ""} onChange={(e) => updateQ(i, { labelMax: e.target.value })} /></div>
              </div>
            )}

            {(q.type === "classement" || q.type === "seuil") && (
              <ClassementBuilder
                products={products}
                codes={q.codes || []}
                correctOrder={q.correctOrder || []}
                onChangeCodes={(c) => updateQ(i, { codes: c })}
                onChangeOrder={(o) => updateQ(i, { correctOrder: o })}
              />
            )}

            {q.type === "triangulaire" && (
              <TriangulaireBuilder
                products={products}
                codes={q.codes || []}
                correctAnswer={q.correctAnswer || ""}
                onChangeCodes={(c) => updateQ(i, { codes: c })}
                onChangeCorrect={(v) => updateQ(i, { correctAnswer: v })}
              />
            )}

            {q.type === "duo-trio" && (
              <DuoTrioBuilder
                products={products}
                codes={q.codes || []}
                correctAnswer={q.correctAnswer || ""}
                onChangeCodes={(c) => updateQ(i, { codes: c })}
                onChangeCorrect={(v) => updateQ(i, { correctAnswer: v })}
              />
            )}

            {q.type === "a-non-a" && (
              <ANonABuilder
                products={products}
                codes={q.codes || []}
                correctAnswer={q.correctAnswer || ""}
                onChangeCodes={(c) => updateQ(i, { codes: c })}
                onChangeCorrect={(v) => updateQ(i, { correctAnswer: v })}
              />
            )}

            {q.type === "qcm" && (
              <QCMOptions options={q.options || []} onChange={(o) => updateQ(i, { options: o })} />
            )}

          </div>
        </div>
      ))}

      {/* Add question buttons */}
      <div style={{ marginTop: "20px" }}>
        <div className="builder-section-label">AJOUTER UNE QUESTION</div>
        <div className="flex mt8" style={{ flexWrap: "wrap" }}>
          {TYPES.map(t => (
            <Button key={t} variant="secondary" size="sm" onClick={() => addQuestion(t)}>
              <FiPlus /> {t}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
