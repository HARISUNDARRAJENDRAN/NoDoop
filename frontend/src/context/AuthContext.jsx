import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { login as apiLogin, register as apiRegister, refreshToken as apiRefresh } from "../lib/api.js";

const AuthContext = createContext(null);

const STORAGE_KEY = "nodoop_auth";

function loadPersistedAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistAuth(data) {
  if (data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadPersistedAuth);

  useEffect(() => {
    persistAuth(auth);
  }, [auth]);

  const login = useCallback(async ({ email, password }) => {
    const data = await apiLogin({ email, password });
    setAuth({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user
    });
    return data;
  }, []);

  const register = useCallback(async ({ email, name, password }) => {
    return apiRegister({ email, name, password });
  }, []);

  const refresh = useCallback(async () => {
    if (!auth?.refreshToken) return null;
    try {
      const data = await apiRefresh(auth.refreshToken);
      setAuth((prev) => ({ ...prev, accessToken: data.accessToken }));
      return data.accessToken;
    } catch {
      setAuth(null);
      return null;
    }
  }, [auth?.refreshToken]);

  const logout = useCallback(() => {
    setAuth(null);
  }, []);

  const value = useMemo(
    () => ({
      user: auth?.user ?? null,
      token: auth?.accessToken ?? null,
      isAuthenticated: Boolean(auth?.accessToken),
      login,
      register,
      refresh,
      logout
    }),
    [auth, login, register, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
