"use client";

import { useEffect, useState } from "react";

export const SEARCH_DEBOUNCE_MS = 300;

export function useDebouncedValue<T>(value: T, delay = SEARCH_DEBOUNCE_MS) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (value === "") {
      setDebouncedValue(value);
      return;
    }

    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}
