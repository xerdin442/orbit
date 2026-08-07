"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useSSE<T = unknown>(
  url: string | null,
  onMessage?: (data: T) => void,
) {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const ref = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url);
    ref.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      let parsed: T;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        parsed = event.data as T;
      }
      setData(parsed);
      onMessageRef.current?.(parsed);
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
