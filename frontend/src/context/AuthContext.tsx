import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  clearToken,
  getToken,
  login as apiLogin,
  logout as apiLogout,
  me,
  setToken,
} from "../api";
import type { MeResponse } from "../api";
import { AuthContext } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [ready, setReady] = useState<boolean>(() => !getToken());

  useEffect(() => {
    const stored = getToken();
    if (!stored) return;
    let cancelled = false;
    me()
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch(() => {
        clearToken();
        setTokenState(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin({ email, password });
    setToken(res.token);
    setTokenState(res.token);
    const profile = await me();
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // session may already be expired; clear locally regardless
    }
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, ready, login, logout }),
    [user, token, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
