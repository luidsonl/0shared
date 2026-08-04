import { useCallback, useEffect, useRef, useState } from "react";
import type { FileItem, PublicFileItem } from "../api";
import { toMessage } from "../lib/errors";

interface Page<T> {
  files: T[];
  nextToken: string | null;
}

type FetchPage<T> = (token: string | null) => Promise<Page<T>>;

interface PagedState<T> {
  items: T[];
  nextToken: string | null;
  loading: boolean;
  error: string | null;
  hasPrev: boolean;
  nextPage: () => void;
  prevPage: () => void;
}

export function usePaginatedFiles<T extends FileItem | PublicFileItem>(
  fetcher: FetchPage<T>,
  reloadKey: unknown,
): PagedState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Callers pass reloadKey as an inline array literal (e.g. [sortBy, reloadKey]),
  // so its identity changes on every render. Using the identity as an effect dep
  // would fire the effect after every render, restarting the fetch forever.
  // Serialize to a primitive so the effect only reruns when the value changes.
  const reloadKeyJson = JSON.stringify(reloadKey);

  const load = useCallback(async (token: string | null, reset: boolean) => {
    if (reset) {
      setHistory([]);
      setNextToken(null);
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcherRef.current(token);
      if (requestId.current !== id) return;
      setItems(res.files);
      setNextToken(res.nextToken);
    } catch (err) {
      if (requestId.current !== id) return;
      setError(toMessage(err));
      setItems([]);
      setNextToken(null);
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null, true);
  }, [reloadKeyJson, load]);

  const nextPage = useCallback(() => {
    setHistory((h) => [...h, nextToken ?? ""]);
    void load(nextToken, false);
  }, [nextToken, load]);

  const prevPage = useCallback(() => {
    const target = history.length >= 2 ? history[history.length - 2] : null;
    setHistory((h) => h.slice(0, -1));
    void load(target, false);
  }, [history, load]);

  return { items, nextToken, loading, error, hasPrev: history.length > 0, nextPage, prevPage };
}
