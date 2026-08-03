"use client";

import { useState, useCallback, useRef } from "react";

export function useConfirmation() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [requiresTyping, setRequiresTyping] = useState<string | null>(null);
  const resolveRef = useRef<(confirmed: boolean) => void>(() => {});

  const confirm = useCallback(
    (msg: string, typing?: string): Promise<boolean> => {
      return new Promise((resolve) => {
        setMessage(msg);
        setRequiresTyping(typing ?? null);
        setIsOpen(true);
        resolveRef.current = resolve;
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef.current(true);
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current(false);
  }, []);

  return {
    isOpen,
    message,
    requiresTyping,
    confirm,
    handleConfirm,
    handleCancel,
    setIsOpen,
  };
}
