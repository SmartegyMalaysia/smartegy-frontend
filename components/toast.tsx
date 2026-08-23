"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

export type ToastTone = "success" | "error" | "pending";

export function Toast({ title, subtitle, tone, duration = 4000, onDismiss }: { title: string; subtitle?: string; tone: ToastTone; duration?: number; onDismiss: () => void }) {
  const [remaining, setRemaining] = useState(duration);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const dismissRef = useRef(onDismiss);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  function dismiss() {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => dismissRef.current(), 160);
  }

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const nextRemaining = Math.max(0, duration - (Date.now() - startedAt));
      setRemaining(nextRemaining);
      if (nextRemaining === 0) dismiss();
    }, 50);
    return () => {
      window.clearInterval(timer);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, [duration]);

  return <div className={`toast toast-${tone} ${closing ? "toast-closing" : ""}`.trim()} role={tone === "error" ? "alert" : "status"} aria-live="polite">
    <div className="toast-icon" aria-hidden="true">{tone === "success" ? "✓" : tone === "error" ? "!" : "i"}</div>
    <div className="toast-copy"><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div>
    <button className="toast-dismiss" type="button" onClick={dismiss} aria-label="Dismiss notification"><Icon name="close" size={16} /></button>
    <div className="toast-progress" aria-hidden="true"><span style={{ transform: `scaleX(${remaining / duration})` }} /></div>
  </div>;
}
