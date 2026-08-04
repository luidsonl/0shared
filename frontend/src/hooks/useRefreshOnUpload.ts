import { useEffect, useRef } from "react";
import { FILES_CHANGED_EVENT } from "../lib/events";

export function useRefreshOnUpload(refresh: () => void) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    const handler = () => refreshRef.current();
    window.addEventListener(FILES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FILES_CHANGED_EVENT, handler);
  }, []);
}
