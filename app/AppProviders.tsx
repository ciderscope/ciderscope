"use client";

import { createContext, useContext, useMemo, useCallback, type ReactNode } from "react";
import { Topbar } from "../components/ui/Topbar";
import { useSenso, type SensoState, type SensoActions } from "../hooks/useSenso";

// Contexte d'actions : référence stable, ne se ré-émet jamais après le premier render
// (toutes les actions sont useCallback à deps vides). Les composants qui appellent
// uniquement useAppActions() ne se ré-rendent pas sur les changements d'état.
type AppActions = SensoActions & { handleLogout: () => void };
const AppActionsContext = createContext<AppActions | null>(null);

// Contexte d'état : ré-émet à chaque changement d'état (mode, screen, ja, …).
// Les composants qui lisent l'état doivent passer par useAppState().
const AppStateContext = createContext<SensoState | null>(null);

export const useAppActions = (): AppActions => {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error("useAppActions() must be used inside <AppProviders>");
  return ctx;
};

export const useAppState = (): SensoState => {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState() must be used inside <AppProviders>");
  return ctx;
};

// Vue agrégée rétrocompatible. Note : tout consommateur de useApp() se ré-rend sur
// chaque changement d'état (à cause de l'abonnement au contexte d'état). Pour une
// granularité fine, préférer useAppActions() / useAppState().
export type AppContextValue = SensoState & AppActions;

export const useApp = (): AppContextValue => {
  const state = useAppState();
  const actions = useAppActions();
  return useMemo<AppContextValue>(
    () => ({ ...state, ...actions }),
    [state, actions]
  );
};

export function AppProviders({ children }: { children: ReactNode }) {
  const { state, actions } = useSenso();

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("admin_auth");
    actions.setAdminAuth(false);
  }, [actions]);

  // Actions étendues : on injecte handleLogout. handleLogout est stable car
  // setAdminAuth est stable et actions est stable, donc useCallback ne se rebuilde
  // qu'au premier render.
  const actionsValue = useMemo<AppActions>(
    () => ({ ...actions, handleLogout }),
    [actions, handleLogout]
  );

  return (
    <AppActionsContext.Provider value={actionsValue}>
      <AppStateContext.Provider value={state}>
        <Topbar
          mode={state.mode}
          online={state.online}
          onModeChange={(m) => {
            actions.setMode(m);
            actions.setScreen("landing");
          }}
          onLogout={state.adminAuth ? handleLogout : undefined}
        />
        <main className="app-main">{children}</main>
      </AppStateContext.Provider>
    </AppActionsContext.Provider>
  );
}
