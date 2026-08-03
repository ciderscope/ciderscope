"use client";

import { createContext, useContext, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { Topbar } from "../components/ui/Topbar";
import { useSenso, type SensoState, type SensoActions } from "../hooks/useSenso";
import { useAuth } from "../components/auth/AuthContext";

// Contexte d'actions : référence stable, ne se ré-émet jamais après le premier render
// (toutes les actions sont useCallback à deps vides).
type AppActions = SensoActions & { handleLogout: () => void };
const AppActionsContext = createContext<AppActions | null>(null);

// Contexte d'état : ré-émet à chaque changement d'état (mode, screen, ja, …).
// Les composants qui lisent l'état doivent passer par useAppState().
const AppStateContext = createContext<SensoState | null>(null);

const useAppActions = (): AppActions => {
  const ctx = useContext(AppActionsContext);
  if (!ctx) throw new Error("useAppActions() must be used inside <AppProviders>");
  return ctx;
};

const useAppState = (): SensoState => {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState() must be used inside <AppProviders>");
  return ctx;
};

// Vue agrégée rétrocompatible. Tout consommateur de useApp() se ré-rend sur
// chaque changement d'état à cause de l'abonnement au contexte d'état.
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
  const auth = useAuth();

  const handleLogout = useCallback(() => {
    actions.setAdminAuth(false);
    auth.logout();
  }, [actions, auth]);

  useEffect(() => {
    actions.setAdminAuth(auth.isAuthenticated);
  }, [actions, auth.isAuthenticated]);

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
          onHome={() => {
            actions.setMode("home");
            actions.setScreen("landing");
          }}
          onLogout={auth.isAuthenticated ? handleLogout : undefined}
        />
        <main className="max-w-full overflow-x-clip pt-13 sm:pt-15">{children}</main>
      </AppStateContext.Provider>
    </AppActionsContext.Provider>
  );
}
