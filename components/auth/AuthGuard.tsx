"use client";

import { useEffect, type ReactNode } from "react";
import { Card } from "../ui/Card";
import { useAuth } from "./AuthContext";

export const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const mainAppUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && mainAppUrl) {
      window.location.replace(mainAppUrl);
    }
  }, [isAuthenticated, isLoading, mainAppUrl]);

  if (isLoading) {
    return <div className="p-8 text-center text-[var(--mid)]">Vérification de la session IFPC…</div>;
  }
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-xl px-5 py-12">
        <Card>
          <h1 className="mb-2 text-xl font-bold text-[var(--ink)]">Session administrateur absente</h1>
          <p className="text-sm leading-relaxed text-[var(--mid)]">
            Ouvrez Senso depuis l&apos;application principale pour recevoir votre session sécurisée.
          </p>
        </Card>
      </div>
    );
  }
  return children;
};
