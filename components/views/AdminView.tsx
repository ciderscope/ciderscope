"use client";
import React, { useState, useRef } from "react";
import { FiEdit2, FiCopy, FiX, FiCheck, FiArrowLeft, FiPlus, FiBarChart2, FiList, FiPrinter } from "react-icons/fi";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { AnalyseView } from "./AnalyseView";
import { Question, QuestionType, Product } from "../../types";
import { wlm } from "../../lib/utils";

// ─── Fiche de service ─────────────────────────────────────────────────────────
function printServiceSheet(sessionName: string, cfg: any) {
  const products: Product[] = cfg.products || [];
  const n = products.length;
  if (n === 0) { alert("Aucun échantillon dans cette séance."); return; }

  const sq = wlm(n); // sq[juryIdx][position] = productIdx
  const rows = sq.map((order, juryIdx) => ({
    jury: juryIdx + 1,
    order: order.map((pi: number) => products[pi]?.code ?? "?"),
  }));

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Fiche de service — ${sessionName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 20px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: center; }
  th { background: #f4f4f4; font-weight: 700; }
  td.jury { font-weight: 700; background: #fafafa; }
  .code { font-family: "Courier New", monospace; font-size: 15px; font-weight: 700; }
  @media print { body { padding: 0; } button { display: none; } }
</style>
</head>
<body>
<h1>Fiche de service — ${sessionName}</h1>
<div class="meta">
  ${cfg.date || ""} · Présentation : ${cfg.presMode === "latin" ? "Carré latin" : cfg.presMode === "random" ? "Aléatoire" : "Fixe"} · ${n} échantillons · ${rows.length} positions de jury
</div>
<table>
  <thead>
    <tr>
      <th>Jury n°</th>
      ${rows[0].order.map((_: any, i: number) => `<th>Position ${i + 1}</th>`).join("")}
    </tr>
  </thead>
  <tbody>
    ${rows.map(r => `
    <tr>
      <td class="jury">${r.jury}</td>
      ${r.order.map((c: string) => `<td class="code">${c}</td>`).join("")}
    </tr>`).join("")}
  </tbody>
</table>
<br>
<button onclick="window.print()">🖨 Imprimer</button>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

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
  loadSessionConfig: (id: string) => Promise<any>;
  // Analyse props
  allAnswers: any;
  anSessId: string | null;
  anCfg: any;
  csvData: any[];
  curAnT: string;
  onAnSessChange: (id: string) => void;
  onAnTabChange: (tab: string) => void;
}

export const AdminView = ({
  screen, sessions, editCfg, curEditTab, editSessId,
  onNewSession, onEditSession, onToggleActive, onDuplicateSession, onDeleteSession,
  onSetEditCfg, onSetEditTab, onSaveEdit, onHome, buildCSVRows, downloadCSV, loadSessionConfig,
  allAnswers, anSessId, anCfg, csvData, curAnT, onAnSessChange, onAnTabChange,
}: AdminViewProps) => {
  const [adminSection, setAdminSection] = useState<"seances" | "analyse">("seances");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  if (screen === "landing") {
    return (
      <div className="admin-shell">
        {/* Sub-nav */}
        <div className="admin-section-nav">
          <button
            className={`admin-section-btn${adminSection === "seances" ? " active" : ""}`}
            onClick={() => setAdminSection("seances")}
          >
            <FiList size={13} /> Séances
          </button>
          <button
            className={`admin-section-btn${adminSection === "analyse" ? " active" : ""}`}
            onClick={() => {
              setAdminSection("analyse");
              if (!anSessId && sessions.length) onAnSessChange(sessions[0].id);
            }}
          >
            <FiBarChart2 size={13} /> Analyse
          </button>
        </div>

        {adminSection === "analyse" && (
          <AnalyseView
            sessions={sessions}
            anSessId={anSessId}
            anCfg={anCfg}
            csvData={csvData}
            allAnswers={allAnswers}
            curAnT={curAnT}
            onAnSessChange={onAnSessChange}
            onAnTabChange={onAnTabChange}
            downloadCSV={downloadCSV}
          />
        )}

        {adminSection === "seances" && (
        <>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", flexWrap: "wrap" }}>
          <h2 style={{ fontWeight: 800, fontSize: "22px" }}>Séances</h2>
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
                  <Button variant="ghost" size="sm" title="Fiche de service" onClick={async () => {
                    const cfg = await loadSessionConfig(s.id);
                    if (cfg) printServiceSheet(s.name, cfg);
                  }}><FiPrinter /></Button>
                  <Button variant="ghost" size="sm" onClick={() => onDuplicateSession(s.id)} title="Dupliquer"><FiCopy /></Button>
                  {confirmingId === s.id ? (
                    <div style={{ display: "flex", gap: "4px" }}>
                      <Button variant="danger" size="sm" onClick={() => { onDeleteSession(s.id); setConfirmingId(null); }}>Confirmer ?</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmingId(null)}>Annuler</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" style={{ color: "var(--danger)" }} onClick={() => setConfirmingId(s.id)} title="Supprimer"><FiX /></Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        </>
        )}
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
                  <Button variant="ghost" size="sm" onClick={() => {
                    const existing = editCfg.products.map((p: any) => p.code);
                    let code: string;
                    let attempts = 0;
                    do { code = String(Math.floor(Math.random() * 900) + 100); attempts++; }
                    while (existing.includes(code) && attempts < 1000);
                    onSetEditCfg({ ...editCfg, products: [...editCfg.products, { code, label: "" }] });
                  }}>
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
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("chip-code", code);
    if (onDragStart) onDragStart(e);
  };

  return (
    <div
      className={`admin-chip${active ? " active" : ""}${onDragStart ? " draggable" : ""}`}
      draggable={!!onDragStart}
      onDragStart={onDragStart ? handleDragStart : undefined}
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
// Draggable ordered list (série admin)
// ─────────────────────────────────────────────
function DraggableSerie({ codes, onChange, onRemove, onAdd }: {
  codes: string[];
  onChange: (c: string[]) => void;
  onRemove: (code: string) => void;
  onAdd?: (code: string) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [overEmpty, setOverEmpty] = useState(false);

  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    const code = e.dataTransfer.getData("chip-code");
    const fromSerie = e.dataTransfer.getData("from-serie");

    if (dragIdx !== null) {
      // Internal move
      if (dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
      const next = [...codes];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(i, 0, moved);
      onChange(next);
    } else if (code && fromSerie !== "1" && onAdd) {
      // External add (from pool)
      onAdd(code);
    }
    setDragIdx(null); setOverIdx(null);
  };

  if (codes.length === 0) {
    return (
      <div 
        className={`serie-empty${overEmpty ? " drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOverEmpty(true); }}
        onDragLeave={() => setOverEmpty(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOverEmpty(false);
          const code = e.dataTransfer.getData("chip-code");
          const fromSerie = e.dataTransfer.getData("from-serie");
          if (code && fromSerie !== "1" && onAdd) onAdd(code);
        }}
        style={{ 
          border: "2px dashed var(--border)", 
          borderRadius: "12px", 
          padding: "24px", 
          textAlign: "center",
          transition: "all .15s"
        }}
      >
        Cliquez sur un échantillon ci-dessus pour l&apos;ajouter à la série <br/>
        <span style={{ fontSize: "11px", color: "var(--mid)" }}>ou glissez-le ici</span>
      </div>
    );
  }

  return (
    <div className="draggable-list admin-order-list">
      {codes.map((code, i) => (
        /* ⚠ Le div N'EST PAS draggable — seul le handle l'est */
        <div
          key={code}
          onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
          onDrop={(e) => handleDrop(e, i)}
          className={`draggable-item${dragIdx === i ? " dragging" : ""}${overIdx === i && dragIdx !== i ? " drag-over" : ""}`}
        >
          {/* Handle — seule partie draggable */}
          <span
            className="drag-handle"
            draggable
            onDragStart={(e) => {
              setDragIdx(i);
              e.dataTransfer.setData("chip-code", code);
              e.dataTransfer.setData("from-serie", "1");
            }}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            style={{ cursor: "grab" }}
          >&#8942;&#8942;</span>
          <span className="rank-pos">{i + 1}</span>
          <span className="rank-code">{code}</span>
          {/* × — onClick avec stopPropagation pour éviter les interférences */}
          <button
            className="chip-x"
            style={{ 
              marginLeft: "auto", 
              padding: "6px", 
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(code);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            type="button"
            draggable={false}
          >
            <FiX size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Classement / Seuil builder
// ─────────────────────────────────────────────
function ClassementBuilder({ type, products, codes, correctOrder, onChangeCodes, onChangeOrder }: {
  type: "classement" | "seuil";
  products: Product[];
  codes: string[];
  correctOrder: string[];
  onChangeCodes: (c: string[]) => void;
  onChangeOrder: (o: string[]) => void;
}) {
  const [showCorrectOrder, setShowCorrectOrder] = useState(correctOrder.length > 0);
  const [overPool, setOverPool] = useState(false);
  const poolRef = useRef<HTMLDivElement>(null);

  const pool = products.filter(p => !codes.includes(p.code));

  const addToSerie = (code: string) => {
    onChangeCodes([...codes, code]);
  };

  const removeFromSerie = (code: string) => {
    onChangeCodes(codes.filter(c => c !== code));
    onChangeOrder(correctOrder.filter(c => c !== code));
  };

  return (
    <div>
      {/* Pool — available samples, also accepts drag-back from série */}
      <div className="builder-section-label">
        DISPONIBLES — cliquez pour ajouter · ou glissez ici depuis la série pour retirer
      </div>
      <div
        ref={poolRef}
        className={`chip-pool${overPool ? " drag-over" : ""}`}
        style={{ minHeight: "54px", border: "1.5px dashed var(--border)", borderRadius: "10px", padding: "8px", transition: "border-color .15s, background .15s" }}
        onDragOver={(e) => { e.preventDefault(); setOverPool(true); }}
        onDragLeave={(e) => {
          // Ne pas réinitialiser si la souris entre dans un élément enfant du pool
          if (poolRef.current && !poolRef.current.contains(e.relatedTarget as Node)) {
            setOverPool(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOverPool(false);
          const code = e.dataTransfer.getData("chip-code");
          const fromSerie = e.dataTransfer.getData("from-serie");
          if (code && fromSerie === "1") removeFromSerie(code);
        }}
      >
        {pool.length === 0 && codes.length > 0
          ? <span className="pool-hint">Glisser ici pour retirer de la série</span>
          : pool.length === 0
            ? <span className="pool-hint">Ajoutez d&apos;abord des échantillons dans l&apos;onglet Session.</span>
            : pool.map(p => (
                <Chip
                  key={p.code}
                  code={p.code}
                  onClick={() => addToSerie(p.code)}
                  onDragStart={(e) => { e.dataTransfer.setData("chip-code", p.code); }}
                />
              ))
        }
      </div>

      {/* Série — selected + orderable */}
      <div className="builder-section-label" style={{ marginTop: "16px" }}>
        SÉRIE — {codes.length} échantillon{codes.length > 1 ? "s" : ""} · glissez pour réordonner · × pour retirer
      </div>
      <DraggableSerie codes={codes} onChange={onChangeCodes} onRemove={removeFromSerie} onAdd={addToSerie} />

      {/* Correct order — classement only, optional */}
      {type === "classement" && codes.length > 1 && (
        <div style={{ marginTop: "16px" }}>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={showCorrectOrder}
              onChange={(e) => {
                setShowCorrectOrder(e.target.checked);
                if (!e.target.checked) onChangeOrder([]);
              }}
            />
            <span className="builder-section-label" style={{ margin: 0 }}>ORDRE ATTENDU (optionnel) — définir la bonne réponse</span>
          </label>
          {showCorrectOrder && (
            <>
              <div style={{ fontSize: "12px", color: "var(--mid)", margin: "6px 0 8px" }}>
                Glissez les échantillons dans l&apos;ordre correct attendu du jury
              </div>
              <DraggableSerie
                codes={correctOrder.length ? correctOrder.filter(c => codes.includes(c)) : [...codes]}
                onChange={onChangeOrder}
                onRemove={(code) => onChangeOrder(correctOrder.filter(c => c !== code))}
                onAdd={(code) => {
                  if (codes.includes(code) && !correctOrder.includes(code)) {
                    onChangeOrder([...correctOrder, code]);
                  }
                }}
              />
            </>
          )}
        </div>
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
// A non-A builder (two drop zones + référence)
// ─────────────────────────────────────────────
function ANonABuilder({ products, codes, correctAnswer, refCode, onChangeCodes, onChangeCorrect, onChangeRef }: {
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
        className={`drop-slot${overRef ? " drag-over" : ""}${refCode ? " filled" : ""}`}
        style={{ maxWidth: "200px", marginBottom: "16px" }}
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
            const newAss = Object.fromEntries(Object.entries(
              Object.fromEntries((typeof correctAnswer === "string" ? correctAnswer : "").split(",").map((p: string) => p.split(":")).filter((a: string[]) => a.length === 2))
            ).filter(([k]) => k !== c));
            onChangeCorrect(Object.entries(newAss).map(([k, v]) => `${k}:${v}`).join(","));
            onChangeRef(c);
          }
          setOverRef(false);
        }}
      >
        <div className="drop-slot-label" style={{ color: "var(--accent)" }}>Référence A</div>
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
function QuestionBuilder({ editCfg, onSetEditCfg }: { editCfg: any; onSetEditCfg: (val: any) => void }) {
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
    if (type === "classement" || type === "seuil") { newQ.codes = []; newQ.correctOrder = []; }
    
    onSetEditCfg((prev: any) => ({ ...prev, questions: [...prev.questions, newQ] }));
  };

  const updateQ = (i: number, patch: Partial<Question>) => {
    onSetEditCfg((prev: any) => {
      const n = [...prev.questions];
      n[i] = { ...n[i], ...patch };
      return { ...prev, questions: n };
    });
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
            <button className="q-del" onClick={() => onSetEditCfg((prev: any) => ({ ...prev, questions: prev.questions.filter((_: any, idx: number) => idx !== i) }))}>
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
                type={q.type}
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
                refCode={q.refCode || ""}
                onChangeCodes={(c) => updateQ(i, { codes: c })}
                onChangeCorrect={(v) => updateQ(i, { correctAnswer: v })}
                onChangeRef={(v) => updateQ(i, { refCode: v })}
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
