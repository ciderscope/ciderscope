import { Card } from "../ui/Card";
import { Radar } from "react-chartjs-2";

const COLORS = ["#c8520a", "#2e6b8a", "#1a6b3a", "#8a4c8a", "#8a6d00", "#5a4030", "#2a5a7a", "#5a6a2a"];

interface AnalyseViewProps {
  sessions: any[];
  anSessId: string | null;
  anCfg: any;
  csvData: any[];
  curAnT: string;
  onAnSessChange: (id: string) => void;
  onAnTabChange: (tab: string) => void;
}

export const AnalyseView = ({
  sessions, anSessId, anCfg, csvData, curAnT,
  onAnSessChange, onAnTabChange
}: AnalyseViewProps) => {
  return (
    <div className="analyse-shell">
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "Syne", fontWeight: 800, fontSize: "22px" }}>Analyse</h2>
        <div style={{ flex: 1 }}></div>
        <label style={{ fontFamily: "DM Mono, monospace", fontSize: "11px", color: "var(--mid)" }}>Séance :</label>
        <select
          value={anSessId || ""}
          onChange={(e) => onAnSessChange(e.target.value)}
          style={{ border: "1px solid var(--border)", borderRadius: "6px", padding: "5px 8px", fontSize: "12px" }}
        >
          {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="analyse-tabs">
        {["profil", "friedman", "seuil", "discrim", "jury", "données"].map(t => (
          <div
            key={t}
            className={`analyse-tab ${curAnT === t ? "active" : ""}`}
            onClick={() => onAnTabChange(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>
      <div id="anContent">
        {curAnT === "profil" && anCfg && <AnalyseProfil config={anCfg} data={csvData} />}
        {curAnT === "friedman" && <AnalyseFriedman data={csvData} />}
        {curAnT === "discrim" && <AnalyseDiscrim data={csvData} />}
        {curAnT === "données" && <AnalyseDonnees data={csvData} />}
      </div>
    </div>
  );
};

function AnalyseProfil({ config, data }: { config: any; data: any[] }) {
  const scaleData = data.filter(r => r.type === "scale" && r.valeur !== "");
  const products = [...new Set(scaleData.map(r => r.produit))];
  const criteria = [...new Set(scaleData.map(r => r.question))];

  const radarData = {
    labels: criteria,
    datasets: products.map((p, i) => ({
      label: p,
      data: criteria.map(c => {
        const vals = scaleData.filter(r => r.produit === p && r.question === c).map(r => parseFloat(r.valeur));
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      }),
      borderColor: COLORS[i % 8],
      backgroundColor: COLORS[i % 8] + "22",
    }))
  };

  return (
    <div className="grid2">
      <Card title="Radar — Profil moyen">
        <Radar data={radarData} />
      </Card>
      <Card title="Moyennes">
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
                  return <td key={p} className="num">{m}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AnalyseFriedman({ data }: { data: any[] }) {
  const rankRows = data.filter(r => r.type === "classement" || r.type === "seuil");
  const questions = [...new Set(rankRows.map(r => r.question))];

  return (
    <Card title="Test de Friedman">
      <table className="data-table">
        <thead>
          <tr><th>Question</th><th>Rangs moyens</th><th>Ordre correct</th></tr>
        </thead>
        <tbody>
          {questions.map(q => {
            const qRows = rankRows.filter(r => r.question === q && r.valeur);
            const correct = qRows[0]?.correct || "";
            return (
              <tr key={q}>
                <td>{q}</td>
                <td>{qRows.length} réponses</td>
                <td style={{ fontFamily: "DM Mono, monospace", fontSize: "12px" }}>{correct}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function AnalyseDiscrim({ data }: { data: any[] }) {
  const dd = data.filter(r => ["triangulaire", "duo-trio", "a-non-a"].includes(r.type));
  const questions = [...new Set(dd.map(r => r.question))];

  return (
    <Card title="Tests discriminatifs">
      <table className="data-table">
        <thead>
          <tr><th>Question</th><th>Type</th><th>n</th><th>Corrects</th><th>%</th></tr>
        </thead>
        <tbody>
          {questions.map(q => {
            const qd = dd.filter(r => r.question === q);
            const type = qd[0]?.type || "";
            let nc = 0;
            if (type === "a-non-a") {
              // Compare JSON objects
              qd.forEach(r => {
                try {
                  const val = typeof r.valeur === "string" ? JSON.parse(r.valeur) : r.valeur;
                  const cor = typeof r.correct === "string" && r.correct.includes(":")
                    ? Object.fromEntries(r.correct.split(",").map((p: string) => p.split(":")))
                    : {};
                  if (JSON.stringify(val) === JSON.stringify(cor)) nc++;
                } catch { /* ignore */ }
              });
            } else {
              nc = qd.filter(r => r.valeur === r.correct).length;
            }
            return (
              <tr key={q}>
                <td>{q}</td>
                <td><span style={{ fontFamily: "DM Mono, monospace", fontSize: "11px" }}>{type}</span></td>
                <td className="num">{qd.length}</td>
                <td className="num">{nc}</td>
                <td className="num">{qd.length ? (nc / qd.length * 100).toFixed(0) : 0}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function AnalyseDonnees({ data }: { data: any[] }) {
  if (data.length === 0) return <p>Aucune donnée.</p>;
  const headers = Object.keys(data[0]);
  return (
    <Card title="Aperçu des données">
      <div style={{ overflowX: "auto", maxHeight: "500px", overflowY: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.slice(0, 100).map((r, i) => (
              <tr key={i}>{headers.map(h => <td key={h}>{r[h]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
