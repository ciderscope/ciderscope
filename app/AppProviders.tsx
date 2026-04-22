"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Topbar } from "../components/ui/Topbar";
import { useSenso } from "../hooks/useSenso";

type Senso = ReturnType<typeof useSenso>;

type AppContextValue = Senso & {
  adminAuth: boolean;
  setAdminAuth: (v: boolean) => void;
  handleLogout: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp() must be used inside <AppProviders>");
  return ctx;
};

export function AppProviders({ children }: { children: ReactNode }) {
  const senso = useSenso();

  const [adminAuth, setAdminAuth] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("admin_auth") === "1";
    }
    return false;
  });

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    setAdminAuth(false);
  };

  const value: AppContextValue = { ...senso, adminAuth, setAdminAuth, handleLogout };

  return (
    <AppContext.Provider value={value}>
      <Topbar
        mode={senso.mode}
        online={senso.online}
        onModeChange={(m) => {
          senso.setMode(m);
          senso.setScreen("landing");
        }}
        onLogout={adminAuth ? handleLogout : undefined}
      />
      <main className="app-main">{children}</main>
    </AppContext.Provider>
  );
}
