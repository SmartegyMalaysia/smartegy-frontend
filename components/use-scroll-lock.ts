"use client";

import { useEffect } from "react";

let activeScrollLocks = 0;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";
let previousBodyOverscrollBehavior = "";
let previousHtmlOverscrollBehavior = "";

function lockDocumentScroll() {
  if (typeof document === "undefined") return;

  if (activeScrollLocks === 0) {
    const html = document.documentElement;
    const body = document.body;
    previousHtmlOverflow = html.style.overflow;
    previousBodyOverflow = body.style.overflow;
    previousHtmlOverscrollBehavior = html.style.overscrollBehavior;
    previousBodyOverscrollBehavior = body.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
  }

  activeScrollLocks += 1;
}

function unlockDocumentScroll() {
  if (typeof document === "undefined" || activeScrollLocks === 0) return;

  activeScrollLocks -= 1;
  if (activeScrollLocks > 0) return;

  document.documentElement.style.overflow = previousHtmlOverflow;
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
  document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
}

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    lockDocumentScroll();
    return unlockDocumentScroll;
  }, [locked]);
}
