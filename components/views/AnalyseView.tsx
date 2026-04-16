"use client";
import { useMemo } from "react";
import { Card } from "../ui/Card";
import { Radar, Bar } from "react-chartjs-2";

const COLORS = ["#c8520a", "#2e6b8a", "#1a6b3a", "#8a4c8a", "#8a6d00", "#5a4030", "#2a5a7a", "#5a6a2a"];

// ─── Stats helpers ───────────────────────────────────────────────────────────

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - d * poly;
  return z >= 0 ? p : 1 - p;
}

function chiSquarePValue(chi2: number, df: number): number {
  if (chi2 <= 0 || df <= 0) return 1;
  const z = ((chi2 / df) ** (1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return Math.max(0, Math.min(1, 1 - normalCDF(z)));
}

// Nemenyi Critical Values (Alpha = 0.05, divided by sqrt(2) as used in some formulas)
// Approximate q values for Nemenyi test (Friedman version)
function getNemenyiCD(k: number, n: number): number {
  const qValues: Record<number, number> = {
    2: 2.77, 3: 3.31, 4: 3.63, 5: 3.86, 6: 4.03, 7: 4.17, 8: 4.29, 9: 4.39, 10: 4.47
  };
  const q = qValues[k] || (4.47 + (k - 10) * 0.08); // fallback
  // CD = q * sqrt(k*(k+1) / (6*n))
  return q * Math.sqrt((k * (k + 1)) / (6 * n));
}

function computeCLD(products: string[], rankMeans: Record<string, number>, cd: number): Record<string, string> {
  const sorted = [...products].sort((a, b) => rankMeans[a] - rankMeans[b]);
  const k = sorted.length;
  const groups: number[][] = [];
  
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      if (Math.abs(rankMeans[sorted[i]] - rankMeans[sorted[j]]) <= cd) {
        // They are in the same group
        let found = false;
        for (const g of groups) {
          if (g.includes(i) || g.includes(j)) {
            // This logic is a bit complex for a simple loop, let's use the standard algorithm
          }
        }
      }
    }
  }
  
  // Simplified CLD algorithm
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const pGroups: string[][] = [];
  
  for (let i = 0; i < k; i++) {
    const currentGroup = [sorted[i]];
    for (let j = i + 1; j < k; j++) {
      if (Math.abs(rankMeans[sorted[i]] - rankMeans[sorted[j]]) <= cd) {
        currentGroup.push(sorted[j]);
      } else {
        break;
      }
    }
    if (currentGroup.length > 1) {
      // Check if this group is a subset of an existing one
      const isSubset = pGroups.some((g: string[]) => currentGroup.every((item: string) => g.includes(item)));
      if (!isSubset) pGroups.push(currentGroup);
    } else {
      pGroups.push(currentGroup);
    }
  }

  // Clean up subsets
  const finalGroups = pGroups.filter((g: string[], i: number) => !pGroups.some((other: string[], j: number) => i !== j && g.every((item: string) => other.includes(item))));
  
  const productLetters: Record<string, string> = {};
  products.forEach((p: string) => productLetters[p] = "");
  
  finalGroups.forEach((group: string[], idx: number) => {
    const letter = letters[idx % 26];
    group.forEach((p: string) => productLetters[p] += letter);
  });
  
  return productLetters;
}

// Spearman correlation for ranking comparison
function spearmanRho(rank1: Record<string, number>, rank2: Record<string, number>, products: string[]): number {
  const n = products.length;
  if (n <= 1) return 1;
  let d2 = 0;
  products.forEach((p: string) => {
    const d = (rank1[p] || 0) - (rank2[p] || 0);
    d2 += d * d;
  });
  return 1 - (6 * d2) / (n * (n * n - 1));
}

function wordColor(w: string) {
  let h = 0;
  for (const c of w) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[h % COLORS.length];
}

// ─── Dynamic tab computation ──────────────────────────────────────────────────

function computeTabs(anCfg: any): { id: string; label: string }[] {
  if (!anCfg) return [{ id: "données", label: "Données" }];
  const qs: any[] = anCfg.questions || [];
  const tabs: { id: string; label: string }[] = [];

  if (qs.some(q => q.type === "scale"))       tabs.push({ id: "profil",      label: "Profil" });
  if (qs.some(q => q.type === "classement"))  tabs.push({ id: "classement",  label: "Classement" });
  if (qs.some(q => q.type === "seuil"))       tabs.push({ id: "seuil",       label: "Seuil" });
  if (qs.some(q => q.type === "triangulaire"))tabs.push({ id: "triangulaire",label: "Triangulaire" });
  if (qs.some(q => q.type === "duo-trio"))    tabs.push({ id: "duo-trio",    label: "Duo-trio" });
  if (qs.some(q => q.type === "a-non-a"))     tabs.push({ id: "a-non-a",     label: "A-non-A" });
  if (qs.some(q => q.type === "text"))        tabs.push({ id: "texte",       label: "Nuage de mots" });
  tabs.push({ id: "jury",    label: "Par jury" });
  tabs.push({ id: "données", label: "Données" });
  return tabs;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AnalyseViewProps {
  sessions: any[];
  anSessId: string | null;
  anCfg: any;
  csvData: any[];
  allAnswers: any;
  curAnT: string;
  onAnSessChange: (id: string) => void;
  onAnTabChange: (tab: string) => void;
  downloadCSV: (rows: any[], name: string) => void;
}

export const AnalyseView = ({
  sessions, anSessId, anCfg, csvData, allAnswers, curAnT,
  onAnSessChange, onAnTabChange, downloadCSV
}: AnalyseViewProps) => {
  const tabs = useMemo(() => computeTabs(anCfg), [anCfg]);

  // Auto-select first valid tab when config changes
  const validIds = tabs.map(t => t.id);
  const activeTab = validIds.includes(curAnT) ? curAnT : (validIds[0] ?? "données");

  return (
    <div className="analyse-shell">
      {/* Session selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", flexWrap: "wrap" }}>
        <h2 style={{ fontWeight: 800, fontSize: "clamp(17px,2.5vw,22px)" }}>Analyse</h2>
        <div style={{ flex: 1 }} />
        <label style={{ fontFamily: "DM Mono, monospace", fontSize: "11px", color: "var(--mid)" }}>Séance :</label>
        <select
          value={anSessId || ""}
          onChange={(e) => onAnSessChange(e.target.value)}
          style={{ border: "1px solid var(--border)", borderRadius: "6px", padding: "5px 8px", fontSize: "12px" }}
        >
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {anCfg && (
          <button
            onClick={() => downloadCSV(csvData, anCfg.name)}
            style={{ fontSize: "12px", padding: "5px 10px", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer", background: "var(--surface)", color: "var(--text-primary)" }}
          >
            ↓ CSV
          </button>
        )}
      </div>

      {!anCfg && (
        <div style={{ color: "var(--text-muted)", fontSize: "14px", padding: "32px 0" }}>
          Sélectionnez une séance pour afficher l&apos;analyse.
        </div>
      )}

      {anCfg && (
        <>
          {/* Dynamic tabs */}
          <div className="analyse-tabs">
            {tabs.map(t => (
              <div
                key={t.id}
                className={`analyse-tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => onAnTabChange(t.id)}
              >
                {t.label}
              </div>
            ))}
          </div>

          <div id="anContent">
            {activeTab === "profil"       && <AnalyseProfil      config={anCfg} data={csvData} />}
            {activeTab === "classement"   && <AnalyseFriedman    data={csvData} type="classement" />}
            {activeTab === "seuil"        && <AnalyseFriedman    data={csvData} type="seuil" />}
            {activeTab === "triangulaire" && <AnalyseDiscrimType data={csvData} type="triangulaire" label="Triangulaire" />}
            {activeTab === "duo-trio"     && <AnalyseDiscrimType data={csvData} type="duo-trio"     label="Duo-trio" />}
            {activeTab === "a-non-a"      && <AnalyseDiscrimType data={csvData} type="a-non-a"      label="A-non-A" />}
            {activeTab === "texte"        && <AnalyseWordCloud   data={csvData} />}
            {activeTab === "jury"         && <AnalyseJury        config={anCfg} allAnswers={allAnswers} />}
            {activeTab === "données"      && <AnalyseDonnees     data={csvData} />}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Profil (échelles) ────────────────────────────────────────────────────────

function AnalyseProfil({ config, data }: { config: any; data: any[] }) {
  const scaleData = data.filter(r => r.type === "scale" && r.valeur !== "" && r.valeur != null);
  const products = [...new Set(scaleData.map(r => r.produit))];
  const criteria = [...new Set(scaleData.map(r => r.question))];

  if (scaleData.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune donnée d&apos;échelle disponible.</div>;
  }

  const avg = (prod: string, crit: string) => {
    const vals = scaleData.filter(r => r.produit === prod && r.question === crit).map(r => parseFloat(r.valeur));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const radarData = {
    labels: criteria,
    datasets: products.map((p, i) => ({
      label: p,
      data: criteria.map(c => avg(p, c)),
      borderColor: COLORS[i % 8],
      backgroundColor: COLORS[i % 8] + "22",
      pointBackgroundColor: COLORS[i % 8],
    }))
  };

  return (
    <div className="grid2">
      <Card title="Radar — Profil moyen">
        <Radar data={radarData} options={{ scales: { r: { beginAtZero: true } } }} />
      </Card>
      <Card title="Moyennes par critère">
        <table className="data-table">
          <thead>
            <tr>
              <th>Critère</th>
              {products.map(p => <th key={p}>{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {criteria.map(c => (
              <tr key={c}>
                <td>{c}</td>
                {products.map(p => {
                  const vals = scaleData.filter(r => r.produit === p && r.question === c).map(r => parseFloat(r.valeur));
                  const m = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "—";
                  const sd = vals.length > 1
                    ? Math.sqrt(vals.reduce((a, b) => a + (b - parseFloat(m)) ** 2, 0) / (vals.length - 1)).toFixed(2)
                    : "—";
                  return <td key={p} className="num">{m}<br /><span style={{ fontSize: "10px", color: "var(--text-muted)" }}>±{sd}</span></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Classement & Seuil → Friedman + Nemenyi ──────────────────────────────────

function AnalyseFriedman({ data, type }: { data: any[]; type: "classement" | "seuil" }) {
  const rankRows = data.filter(r => r.type === type && r.valeur);
  const questions = [...new Set(rankRows.map(r => r.question))];
  const title = type === "seuil" ? "Seuil" : "Classement";

  if (rankRows.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune donnée de {type} disponible.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {questions.map(q => {
        const qRows = rankRows.filter(r => r.question === q && r.valeur);
        // Parse "A>B>C" → {A:1, B:2, C:3}
        const matrices: Record<string, number>[] = qRows
          .map(r => {
            const parts = (r.valeur as string).split(">");
            const obj: Record<string, number> = {};
            parts.forEach((code, idx) => { obj[code.trim()] = idx + 1; });
            return obj;
          })
          .filter(m => Object.keys(m).length > 0);

        const products = [...new Set(matrices.flatMap(m => Object.keys(m)))];
        const n = matrices.length;
        const k = products.length;

        if (n < 2 || k < 2) {
          return (
            <Card key={q} title={`${title} — ${q}`}>
              <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                Pas assez de réponses ({n} jury{n > 1 ? "s" : ""}) pour calculer le test de Friedman.
              </p>
            </Card>
          );
        }

        // Rank sums
        const rankSums: Record<string, number> = {};
        products.forEach(p => {
          rankSums[p] = matrices.reduce((s, m) => s + (m[p] ?? (k + 1) / 2), 0);
        });
        const rankMeans: Record<string, number> = {};
        products.forEach(p => { rankMeans[p] = rankSums[p] / n; });

        // Friedman chi2
        const sumRankSq = products.reduce((s, p) => s + rankSums[p] ** 2, 0);
        const chi2 = (12 / (n * k * (k + 1))) * sumRankSq - 3 * n * (k + 1);
        const df = k - 1;
        const pValue = chiSquarePValue(chi2, df);

        const sig = pValue < 0.001 ? "***" : pValue < 0.01 ? "**" : pValue < 0.05 ? "*" : "ns";
        const sigColor = pValue < 0.05 ? "#1a6b3a" : "#888";

        // Correct order comparison
        const correctStr = qRows[0]?.correct || "";
        const correctProducts = correctStr ? correctStr.split(">").map((s: string) => s.trim()) : [];
        let matchCount = 0;
        let avgCorrelation = 0;
        
        if (correctProducts.length > 0) {
          const correctRank: Record<string, number> = {};
          correctProducts.forEach((p: string, idx: number) => { correctRank[p] = idx + 1; });
          
          matrices.forEach(m => {
            if (Object.keys(m).every((p: string) => correctRank[p] === m[p])) matchCount++;
            avgCorrelation += spearmanRho(correctRank, m, products);
          });
          avgCorrelation /= n;
        }

        // Nemenyi Post-hoc & CLD
        const nemenyiCD = getNemenyiCD(k, n);
        const cld = pValue < 0.05 ? computeCLD(products, rankMeans, nemenyiCD) : {};

        // Bar chart data — rank means (lower = better rank)
        const sortedByMean = [...products].sort((a, b) => rankMeans[a] - rankMeans[b]);
        const barData = {
          labels: sortedByMean,
          datasets: [{
            label: "Rang moyen",
            data: sortedByMean.map((p: string) => parseFloat(rankMeans[p].toFixed(2))),
            backgroundColor: sortedByMean.map((_, i) => COLORS[i % 8] + "cc"),
            borderColor: sortedByMean.map((_, i) => COLORS[i % 8]),
            borderWidth: 1,
          }]
        };

        return (
          <Card key={q} title={`${title} — ${q}`}>
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 260px", maxWidth: "360px" }}>
                <Bar
                  data={barData}
                  options={{
                    indexAxis: "y" as const,
                    scales: { x: { beginAtZero: true, max: k, title: { display: true, text: "Rang moyen (1 = 1er)" } } },
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Produit</th><th>Rang moyen</th>{pValue < 0.05 && <th>Gr.</th>}</tr>
                  </thead>
                  <tbody>
                    {sortedByMean.map(p => (
                      <tr key={p}>
                        <td style={{ fontFamily: "DM Mono, monospace" }}>{p}</td>
                        <td className="num">{rankMeans[p].toFixed(2)}</td>
                        {pValue < 0.05 && <td style={{ textAlign: "center", fontWeight: 700, color: "var(--accent)" }}>{cld[p]}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: "16px", padding: "12px 14px", background: "var(--bg)", borderRadius: "8px", fontSize: "13px", lineHeight: 1.8 }}>
                  <div><strong>Test de Friedman</strong></div>
                  <div>n = {n} jurys · k = {k} produits</div>
                  <div>χ² = {chi2.toFixed(3)} · p = {pValue < 0.001 ? "< 0,001" : pValue.toFixed(3)} <span style={{ fontWeight: 700, color: sigColor }}>{sig}</span></div>
                  
                  {pValue < 0.05 && (
                    <div style={{ marginTop: "12px" }}>
                      <strong>Post-hoc de Nemenyi</strong> (α=0,05)
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Différence Critique (CD) = {nemenyiCD.toFixed(2)}</div>
                      <div style={{ fontSize: "11px", color: "#1a6b3a", fontStyle: "italic", marginBottom: "8px" }}>
                        Les produits partageant une même lettre ne sont pas significativement différents.
                      </div>
                      
                      {/* Pairwise comparisons table */}
                      <details>
                        <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--mid)" }}>Afficher les comparaisons par paires</summary>
                        <table className="data-table" style={{ marginTop: "8px", fontSize: "11px" }}>
                          <thead>
                            <tr><th>Paire</th><th>Diff. Σ Rangs</th><th>Signif.</th></tr>
                          </thead>
                          <tbody>
                            {products.map((p1: string, i: number) => 
                              products.slice(i + 1).map((p2: string) => {
                                const diff = Math.abs(rankSums[p1] - rankSums[p2]);
                                const isSig = diff > nemenyiCD * n;
                                return (
                                  <tr key={`${p1}-${p2}`}>
                                    <td>{p1} vs {p2}</td>
                                    <td className="num">{diff.toFixed(1)}</td>
                                    <td style={{ color: isSig ? "var(--danger)" : "var(--mid)", fontWeight: isSig ? 700 : 400 }}>
                                      {isSig ? "Oui" : "Non"}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </details>
                    </div>
                  )}

                  {correctProducts.length > 0 && (
                    <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                      <strong>Conformité à l&apos;ordre attendu</strong>
                      <div>{matchCount} / {n} jurys exacts ({(matchCount / n * 100).toFixed(0)}%)</div>
                      <div>Corrélation moyenne ρ = {avgCorrelation.toFixed(2)}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Attendu : {correctProducts.join(" > ")}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {type === "seuil" && (
               <details style={{ marginTop: "16px" }}>
                 <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--mid)" }}>Afficher la distribution des rangs</summary>
                 <div style={{ marginTop: "10px", display: "flex", gap: "20px", flexWrap: "wrap" }}>
                    <table className="data-table" style={{ flex: 1 }}>
                      <thead><tr><th>Produit</th>{products.map((_, i) => <th key={i}>R{i + 1}</th>)}</tr></thead>
                      <tbody>
                        {products.map((p: string) => (
                          <tr key={p}>
                            <td>{p}</td>
                            {products.map((_, idx) => {
                              const count = matrices.filter((m: Record<string, number>) => m[p] === idx + 1).length;
                              return <td key={idx} className="num">{count}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
               </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}


// ─── Tests discriminatifs (un type à la fois) ─────────────────────────────────

function AnalyseDiscrimType({ data, type, label }: { data: any[]; type: string; label: string }) {
  const dd = data.filter(r => r.type === type);
  const questions = [...new Set(dd.map(r => r.question))];

  if (dd.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune donnée disponible.</div>;
  }

  // Binomial test p-value (exact, one-sided)
  // P(X >= k | n, p_chance) where p_chance = 1/3 for triangulaire, 1/2 for duo-trio, varies for a-non-a
  const pChance = type === "triangulaire" ? 1 / 3 : type === "duo-trio" ? 1 / 2 : 0.5;

  const binomialPValue = (n: number, k: number, p: number): number => {
    if (n === 0) return 1;
    // P(X >= k) = sum P(X=i) for i=k..n
    let prob = 0;
    for (let i = k; i <= n; i++) {
      prob += binomCoeff(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
    }
    return Math.min(1, prob);
  };

  const binomCoeff = (n: number, k: number): number => {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    let c = 1;
    for (let i = 0; i < Math.min(k, n - k); i++) {
      c = c * (n - i) / (i + 1);
    }
    return c;
  };

  // Minimum correct answers for significance (p<0.05, one-sided)
  const minCorrect = (n: number, p: number): number => {
    for (let k = n; k >= 0; k--) {
      if (binomialPValue(n, k, p) >= 0.05) return k + 1;
    }
    return 0;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {questions.map(q => {
        const qd = dd.filter(r => r.question === q);
        const n = qd.length;
        let nc = 0;

        if (type === "a-non-a") {
          qd.forEach(r => {
            try {
              const val = typeof r.valeur === "string" && r.valeur.startsWith("{") ? JSON.parse(r.valeur) : r.valeur;
              const cor = typeof r.correct === "string" && r.correct.includes(":")
                ? Object.fromEntries(r.correct.split(",").map((p: string) => p.split(":")))
                : {};
              if (JSON.stringify(val) === JSON.stringify(cor)) nc++;
            } catch { /* ignore */ }
          });
        } else {
          nc = qd.filter(r => r.valeur === r.correct).length;
        }

        const pVal = binomialPValue(n, nc, pChance);
        const sig = pVal < 0.001 ? "***" : pVal < 0.01 ? "**" : pVal < 0.05 ? "*" : "ns";
        const sigColor = pVal < 0.05 ? "#1a6b3a" : "#888";
        const minC = minCorrect(n, pChance);
        const pct = n ? (nc / n * 100).toFixed(0) : 0;

        return (
          <Card key={q} title={`${label} — ${q}`}>
            <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "flex-start" }}>
              {/* Big result */}
              <div style={{ textAlign: "center", minWidth: "120px" }}>
                <div style={{ fontSize: "clamp(36px,5vw,52px)", fontWeight: 800, color: nc >= minC ? "#1a6b3a" : "#888" }}>
                  {nc}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>réponses correctes</div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: sigColor, marginTop: "6px" }}>{pct}%</div>
              </div>

              {/* Stats */}
              <div style={{ flex: 1, minWidth: "200px" }}>
                <div style={{ padding: "12px 14px", background: "var(--bg)", borderRadius: "8px", fontSize: "13px", lineHeight: 1.9 }}>
                  <div><strong>Test binomial</strong> (unilatéral)</div>
                  <div>Probabilité chance : {(pChance * 100).toFixed(0)}%</div>
                  <div>Seuil de signification (p&lt;0,05) : ≥ {minC} bonnes réponses</div>
                  <div>
                    p = {pVal < 0.001 ? "< 0,001" : pVal.toFixed(3)}
                    {" "}
                    <span style={{ fontWeight: 700, color: sigColor }}>{sig}</span>
                  </div>
                  {pVal < 0.05
                    ? <div style={{ color: "#1a6b3a", fontWeight: 600, marginTop: "4px" }}>
                        Le panel discrimine significativement les produits (α=0,05)
                      </div>
                    : <div style={{ color: "#c0392b", marginTop: "4px" }}>
                        Pas de différence détectée (α=0,05)
                      </div>
                  }
                </div>

                {/* Per juror results */}
                <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Détail par jury
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>Jury</th><th>Réponse</th><th>Résultat</th></tr>
                  </thead>
                  <tbody>
                    {qd.map((r, i) => {
                      let correct = false;
                      if (type === "a-non-a") {
                        try {
                          const val = typeof r.valeur === "string" && r.valeur.startsWith("{") ? JSON.parse(r.valeur) : r.valeur;
                          const cor = typeof r.correct === "string" && r.correct.includes(":")
                            ? Object.fromEntries(r.correct.split(",").map((p: string) => p.split(":")))
                            : {};
                          correct = JSON.stringify(val) === JSON.stringify(cor);
                        } catch { /* ignore */ }
                      } else {
                        correct = r.valeur === r.correct;
                      }
                      return (
                        <tr key={i}>
                          <td>{r.jury}</td>
                          <td style={{ fontFamily: "DM Mono, monospace", fontSize: "11px" }}>
                            {typeof r.valeur === "string" && r.valeur.length > 30
                              ? r.valeur.slice(0, 30) + "…"
                              : r.valeur}
                          </td>
                          <td style={{ color: correct ? "#1a6b3a" : "#c0392b", fontWeight: 600 }}>
                            {correct ? "✓" : "✗"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Nuage de mots ────────────────────────────────────────────────────────────

function AnalyseWordCloud({ data }: { data: any[] }) {
  const textRows = data.filter(r => r.type === "text" && r.valeur && r.valeur.trim());
  const questions = [...new Set(textRows.map(r => r.question))];

  if (textRows.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune réponse textuelle disponible.</div>;
  }

  // French stop words
  const stopWords = new Set(["le","la","les","de","du","des","un","une","en","et","à","au","aux","ce","se","sa","son","ses","je","tu","il","elle","nous","vous","ils","elles","que","qui","ne","pas","par","sur","avec","dans","est","sont","été","être","avoir","plus","ou","mais","donc","car","si","comme","tout","très","bien","aussi","pour","cette","cet","ces","leur","leurs","même","autre","autres","dont","peu","fait","faire","plus","non","oui","ça","on","lui"]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {questions.map(q => {
        const qRows = textRows.filter(r => r.question === q);
        const wordFreq: Record<string, number> = {};

        qRows.forEach(r => {
          (r.valeur as string)
            .toLowerCase()
            .split(/[\s,;.!?''"()\[\]]+/)
            .map(w => w.replace(/[^a-zàâäéèêëîïôùûüç-]/g, ""))
            .filter(w => w.length > 2 && !stopWords.has(w))
            .forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
        });

        const sorted = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 60);
        const maxFreq = sorted[0]?.[1] || 1;

        return (
          <Card key={q} title={`Texte — ${q}`}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
              {qRows.length} réponse{qRows.length > 1 ? "s" : ""} · {sorted.length} mots distincts
            </div>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px 12px",
              padding: "16px",
              justifyContent: "center",
              alignItems: "center",
              lineHeight: 1.4,
            }}>
              {sorted.map(([word, freq]) => (
                <span
                  key={word}
                  title={`${freq} occurrence${freq > 1 ? "s" : ""}`}
                  style={{
                    fontSize: `${Math.round(11 + (freq / maxFreq) * 28)}px`,
                    fontWeight: freq >= maxFreq * 0.6 ? 700 : freq >= maxFreq * 0.3 ? 600 : 400,
                    color: wordColor(word),
                    opacity: 0.55 + (freq / maxFreq) * 0.45,
                    cursor: "default",
                    transition: "opacity 0.15s",
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
            {/* Frequency table */}
            <details style={{ marginTop: "12px" }}>
              <summary style={{ fontSize: "12px", color: "var(--text-muted)", cursor: "pointer" }}>
                Tableau des fréquences
              </summary>
              <table className="data-table" style={{ marginTop: "8px" }}>
                <thead><tr><th>Mot</th><th>Occurrences</th></tr></thead>
                <tbody>
                  {sorted.slice(0, 20).map(([w, f]) => (
                    <tr key={w}><td>{w}</td><td className="num">{f}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Par jury ─────────────────────────────────────────────────────────────────

function AnalyseJury({ config, allAnswers }: { config: any; allAnswers: any }) {
  const jurors = Object.keys(allAnswers || {});
  if (jurors.length === 0) {
    return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucun jury enregistré.</div>;
  }

  const qs: any[] = config.questions || [];
  const products: any[] = config.products || [];
  const ppQ = qs.filter(q => q.scope === "per-product");

  return (
    <Card title="Avancement par jury">
      <table className="data-table">
        <thead>
          <tr>
            <th>Jury</th>
            {products.map(p => <th key={p.code}>{p.code}</th>)}
            {qs.filter(q => ["classement","seuil","triangulaire","duo-trio","a-non-a"].includes(q.type)).map(q => (
              <th key={q.id} style={{ maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis" }} title={q.label}>
                {q.label.length > 12 ? q.label.slice(0, 10) + "…" : q.label}
              </th>
            ))}
            <th>Global</th>
          </tr>
        </thead>
        <tbody>
          {jurors.map(j => {
            const ja = allAnswers[j] || {};
            return (
              <tr key={j}>
                <td style={{ fontWeight: 600 }}>{j}</td>
                {products.map(p => {
                  const pa = ja[p.code] || {};
                  const answered = ppQ.some(q => pa[q.id] != null);
                  return (
                    <td key={p.code} style={{ textAlign: "center", color: answered ? "#1a6b3a" : "#ccc" }}>
                      {answered ? "✓" : "—"}
                    </td>
                  );
                })}
                {qs.filter(q => ["classement","seuil","triangulaire","duo-trio","a-non-a"].includes(q.type)).map(q => {
                  const section = q.type === "classement" || q.type === "seuil" ? "_rank" : "_discrim";
                  const answered = ja[section]?.[q.id] != null;
                  return (
                    <td key={q.id} style={{ textAlign: "center", color: answered ? "#1a6b3a" : "#ccc" }}>
                      {answered ? "✓" : "—"}
                    </td>
                  );
                })}
                <td style={{ textAlign: "center", color: ja["_global"] && Object.keys(ja["_global"]).length > 0 ? "#1a6b3a" : "#ccc" }}>
                  {ja["_global"] && Object.keys(ja["_global"]).length > 0 ? "✓" : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Données brutes ───────────────────────────────────────────────────────────

function AnalyseDonnees({ data }: { data: any[] }) {
  if (data.length === 0) return <div style={{ color: "var(--text-muted)", padding: "24px 0" }}>Aucune donnée.</div>;
  const headers = Object.keys(data[0]);
  return (
    <Card title="Données brutes">
      <div style={{ overflowX: "auto", maxHeight: "500px", overflowY: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.slice(0, 200).map((r, i) => (
              <tr key={i}>{headers.map(h => <td key={h}>{r[h]}</td>)}</tr>
            ))}
          </tbody>
        </table>
        {data.length > 200 && (
          <div style={{ padding: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
            Affichage des 200 premières lignes sur {data.length}. Exportez le CSV pour tout voir.
          </div>
        )}
      </div>
    </Card>
  );
}
