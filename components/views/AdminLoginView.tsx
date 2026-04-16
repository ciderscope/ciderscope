"use client";
import { useState } from "react";
import { Button } from "../ui/Button";

interface AdminLoginViewProps {
  onSuccess: () => void;
}

export const AdminLoginView = ({ onSuccess }: AdminLoginViewProps) => {
  const [login, setLogin] = useState("");
  const [mdp, setMdp] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login.trim().toUpperCase() === "IFPC" && mdp === "ifpc") {
      sessionStorage.setItem("admin_auth", "1");
      setError(false);
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div style={{
      minHeight: "80vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1.5px solid var(--border)",
        borderRadius: "16px",
        padding: "40px 36px",
        width: "100%",
        maxWidth: "360px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        <h2 style={{
          fontFamily: "Syne",
          fontWeight: 800,
          fontSize: "clamp(18px, 2.5vw, 22px)",
          marginBottom: "6px",
          color: "var(--text-primary)",
        }}>
          Accès administration
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "28px" }}>
          Identifiez-vous pour accéder à la gestion des séances.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Identifiant
            </label>
            <input
              type="text"
              value={login}
              onChange={e => { setLogin(e.target.value); setError(false); }}
              autoComplete="username"
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: error ? "1.5px solid #e74c3c" : "1.5px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text-primary)",
                fontSize: "15px",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={mdp}
              onChange={e => { setMdp(e.target.value); setError(false); }}
              autoComplete="current-password"
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: error ? "1.5px solid #e74c3c" : "1.5px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text-primary)",
                fontSize: "15px",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "#fdecea",
              color: "#c0392b",
              borderRadius: "8px",
              padding: "10px 14px",
              fontSize: "13px",
              fontWeight: 500,
            }}>
              Identifiants incorrects.
            </div>
          )}

          <Button type="submit" style={{ marginTop: "4px", width: "100%" }}>
            Se connecter
          </Button>
        </form>
      </div>
    </div>
  );
};
