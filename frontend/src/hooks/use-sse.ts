"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useSSE<T = unknown>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const ref = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url);
    ref.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        setData(JSON.parse(event.data));
      } catch {
        setData(event.data as T);
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      ref.current = null;
    };
  }, [url]);

  const close = useCallback(() => {
    ref.current?.close();
    ref.current = null;
    setConnected(false);
  }, []);

  return { data, connected, close };
}
