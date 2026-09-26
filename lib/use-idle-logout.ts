"use client";

import { useEffect, useRef } from "react";
import { clearDeveloperView, getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase-browser";
import { logout } from "./auth-repository";

const DEFAULT_IDLE_TIMEOUT_MINUTES = 15;
const configuredIdleTimeoutMinutes = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES);
const idleTimeoutMinutes = Number.isFinite(configuredIdleTimeoutMinutes) && configuredIdleTimeoutMinutes > 0
  ? configuredIdleTimeoutMinutes
  : DEFAULT_IDLE_TIMEOUT_MINUTES;

export const IDLE_TIMEOUT_MS = idleTimeoutMinutes * 60 * 1000;
const ACTIVITY_SYNC_INTERVAL_MS = 1000;

export function useIdleLogout(enabled: boolean, userId: string | null | undefined) {
  const loggingOut = useRef(false);

  useEffect(() => {
    if (!enabled || !userId || typeof window === "undefined") return;

    const activityKey = `smartegy:last-activity:${userId}`;
    let timeoutId: number | null = null;
    let lastActivityWrite = 0;

    const readLastActivity = () => {
      try {
        const stored = Number(window.localStorage.getItem(activityKey));
        return Number.isFinite(stored) && stored > 0 ? stored : 0;
      } catch {
        return 0;
      }
    };

    const writeActivity = (timestamp: number) => {
      try {
        window.localStorage.setItem(activityKey, String(timestamp));
      } catch {
        // Continue with the in-memory timer when browser storage is unavailable.
      }
    };

    const signOutForInactivity = async () => {
      if (loggingOut.current) return;
      loggingOut.current = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      try {
        if (isSupabaseConfigured() && getSupabaseBrowserClient()) await logout("local");
        else clearDeveloperView();
      } finally {
        window.location.replace(new URL("/", window.location.href).toString());
      }
    };

    const scheduleTimeout = () => {
      if (loggingOut.current) return;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      const elapsed = Date.now() - readLastActivity();
      const remaining = IDLE_TIMEOUT_MS - elapsed;
      if (remaining <= 0) {
        void signOutForInactivity();
        return;
      }
      timeoutId = window.setTimeout(() => {
        if (Date.now() - readLastActivity() >= IDLE_TIMEOUT_MS) void signOutForInactivity();
        else scheduleTimeout();
      }, remaining);
    };

    const initialActivity = Date.now();
    writeActivity(initialActivity);
    lastActivityWrite = initialActivity;

    const recordActivity = () => {
      const timestamp = Date.now();
      if (timestamp - lastActivityWrite < ACTIVITY_SYNC_INTERVAL_MS) return;
      lastActivityWrite = timestamp;
      writeActivity(timestamp);
      scheduleTimeout();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === activityKey) scheduleTimeout();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) scheduleTimeout();
    };

    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    window.addEventListener("focus", recordActivity);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleTimeout();

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener("focus", recordActivity);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, userId]);
}
