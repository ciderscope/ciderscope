"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthSession, AuthUser } from "../../services/auth";
import { apiFetch, setApiAuthToken } from "../../services/api";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const readSession = async (token?: string): Promise<AuthSession | null> => {
  const response = await apiFetch("/api/auth/session", {
    method: token ? "POST" : "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<AuthSession>;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((session: AuthSession | null) => {
    const nextToken = session?.token || null;
    setUser(() => session?.user || null);
    setToken(() => nextToken);
    setApiAuthToken(nextToken);
  }, []);

  useEffect(() => {
    let active = true;
    void readSession()
      .then(session => {
        if (active) applySession(session);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applySession]);

  const login = useCallback(async (nextToken: string) => {
    setIsLoading(true);
    try {
      const session = await readSession(nextToken);
      applySession(session);
      return Boolean(session);
    } finally {
      setIsLoading(false);
    }
  }, [applySession]);

  const logout = useCallback(() => {
    applySession(null);
    const mainAppUrl = process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim();
    if (mainAppUrl) window.location.assign(mainAppUrl);
  }, [applySession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    login,
    logout,
  }), [user, token, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth() doit être utilisé dans <AuthProvider>.");
  return context;
};
