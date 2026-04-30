"use client";
import React, { useState } from "react";
import { Button } from "../ui/Button";

interface AdminLoginViewProps {
  onSuccess: () => void;
}

// SHA-256("IFPC:ifpc") — empêche la divulgation triviale par lecture du bundle.
// Pour une vraie sécurité, migrer vers Supabase Auth (auth serveur).
const ADMIN_HASH = "c1c0bc5db72a4f46df22bf877e91df1d26578e097728f41bca4fec55058d18c0";

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export const AdminLoginView = ({ onSuccess }: AdminLoginViewProps) => {
  const [login, setLogin] = useState("");
  const [mdp, setMdp] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const hash = await sha256Hex(`${login.trim().toUpperCase()}:${mdp}`);
    setBusy(false);
    if (hash === ADMIN_HASH) {
      sessionStorage.setItem("admin_auth", "1");
      setError(false);
      onSuccess();
    } else {
      setError(true);
    }
  };

  const inputCls = `px-3.5 py-2.5 rounded-lg bg-[var(--paper)] text-[var(--ink)] text-[15px] outline-none font-[inherit] border-[1.5px] ${error ? "border-[#e74c3c]" : "border-[var(--border)]"}`;
  const labelCls = "text-xs font-semibold text-[var(--mid)] uppercase tracking-[0.05em]";

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white border-[1.5px] border-[var(--border)] rounded-2xl px-9 py-10 w-full max-w-[360px] shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
        <h2 className="font-extrabold mb-1.5 text-[var(--ink)] text-[clamp(18px,2.5vw,22px)]">
          Accès administration
        </h2>
        <p className="text-[var(--mid)] text-[13px] mb-7">
          Identifiez-vous pour accéder à la gestion des séances.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Identifiant</label>
            <input
              type="text"
              value={login}
              onChange={e => { setLogin(e.target.value); setError(false); }}
              autoComplete="username"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Mot de passe</label>
            <input
              type="password"
              value={mdp}
              onChange={e => { setMdp(e.target.value); setError(false); }}
              autoComplete="current-password"
              className={inputCls}
            />
          </div>

          {error && (
            <div className="bg-[#fdecea] text-[#c0392b] rounded-lg px-3.5 py-2.5 text-[13px] font-medium">
              Identifiants incorrects.
            </div>
          )}

          <Button type="submit" disabled={busy} className={`mt-1 w-full ${busy ? "!opacity-60" : ""}`}>
            {busy ? "Vérification…" : "Se connecter"}
          </Button>
        </form>
      </div>
    </div>
  );
};
