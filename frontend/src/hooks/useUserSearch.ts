import { useCallback, useEffect, useState } from "react";
import { searchUsers } from "../api";
import { toMessage } from "../lib/errors";

export interface SearchUser {
  userId: string;
  username: string;
}

interface SearchState {
  users: SearchUser[];
  nextToken: string | null;
  loading: boolean;
  error: string | null;
  hasPrev: boolean;
  nextPage: () => void;
  prevPage: () => void;
}

export function useUserSearch(q: string): SearchState {
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (token: string | null, reset: boolean) => {
      if (reset) {
        setHistory([]);
        setNextToken(null);
      }
      setLoading(true);
      setError(null);
      try {
        const res = await searchUsers(q, token);
        setUsers(res.users);
        setNextToken(res.nextToken);
      } catch (err) {
        setError(toMessage(err));
        setUsers([]);
        setNextToken(null);
      } finally {
        setLoading(false);
      }
    },
    [q],
  );

  useEffect(() => {
    void load(null, true);
  }, [load]);

  const nextPage = useCallback(() => {
    setHistory((h) => [...h, nextToken ?? ""]);
    void load(nextToken, false);
  }, [nextToken, load]);

  const prevPage = useCallback(() => {
    const target = history.length >= 2 ? history[history.length - 2] : null;
    setHistory((h) => h.slice(0, -1));
    void load(target, false);
  }, [history, load]);

  return { users, nextToken, loading, error, hasPrev: history.length > 0, nextPage, prevPage };
}
