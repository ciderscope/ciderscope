"use client";
import React, { useState } from "react";
import { Button } from "../ui/Button";
import { supabase } from "../../lib/supabase";

interface AdminLoginViewProps {
  onSuccess: () => void;
}

export const AdminLoginView = ({ onSuccess }: AdminLoginViewProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message === "Invalid login credentials" 
          ? "Identifiants incorrects (Email ou Mot de passe)." 
          : authError.message
        );
      } else {
        onSuccess();
      }
    } catch (err) {
      setError("Une erreur inattendue est survenue.");
      console.error(err);
    } finally {
      setBusy(false);
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
          Utilisez vos identifiants Supabase pour accéder à la gestion des séances.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Email Professionnel</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
              autoComplete="email"
              placeholder="admin@ifpc.eu"
              required
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              autoComplete="current-password"
              required
              className={inputCls}
            />
          </div>

          {error && (
            <div className="bg-[#fdecea] text-[#c0392b] rounded-lg px-3.5 py-2.5 text-[13px] font-medium">
              {error}
            </div>
          )}

          <Button type="submit" disabled={busy} className={`mt-1 w-full ${busy ? "!opacity-60" : ""}`}>
            {busy ? "Vérification…" : "Se connecter"}
          </Button>
          
          <div className="mt-4 text-[11px] text-[var(--mid)] text-center italic">
            Note : l&apos;accès est désormais protégé par Supabase Auth. Contactez l&apos;administrateur pour créer votre compte.
          </div>
        </form>
      </div>
    </div>
  );
};
