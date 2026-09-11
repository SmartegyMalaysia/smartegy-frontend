"use client";

import { createContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import { useScrollLock } from "./use-scroll-lock";
import { Icon } from "./icons";

export type PopupModalSize = "sm" | "md" | "lg";
export type PopupModalTone = "brand" | "danger" | "success" | "neutral";

export const PopupModalLayerContext = createContext(false);

export type PopupModalProps = {
  open: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  headerActions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: PopupModalSize;
  tone?: PopupModalTone;
  accentColor?: string;
  className?: string;
  bodyClassName?: string;
  closeLabel?: string;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  hasUnsavedChanges?: boolean;
  unsavedChangesMessage?: string;
};

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PopupModal({
  open,
  title,
  description,
  icon,
  headerActions,
  children,
  footer,
  onClose,
  size = "md",
  tone = "brand",
  accentColor,
  className = "",
  bodyClassName = "",
  closeLabel = "Close dialog",
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  hasUnsavedChanges = false,
  unsavedChangesMessage = "You have unsaved changes. Discard them?",
}: PopupModalProps) {
  const modalId = useId();
  const titleId = `${modalId}-title`;
  const descriptionId = `${modalId}-description`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [rendered, setRendered] = useState(open);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [discardChangesOpen, setDiscardChangesOpen] = useState(false);
  const stateRef = useRef({ onClose, closeOnEscape, closeOnBackdrop, hasUnsavedChanges, unsavedChangesMessage });

  useEffect(() => {
    stateRef.current = { onClose, closeOnEscape, closeOnBackdrop, hasUnsavedChanges, unsavedChangesMessage };
  }, [onClose, closeOnEscape, closeOnBackdrop, hasUnsavedChanges, unsavedChangesMessage]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    if (open) {
      setRendered(true);
      setExiting(false);
      return;
    }
    if (!rendered) return;
    setExiting(true);
    closeTimerRef.current = window.setTimeout(() => {
      setRendered(false);
      setExiting(false);
      closeTimerRef.current = null;
    }, 180);
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, [open, rendered]);

  useScrollLock(mounted && rendered);

  function requestClose() {
    const state = stateRef.current;
    if (state.hasUnsavedChanges) {
      setDiscardChangesOpen(true);
      return;
    }
    state.onClose();
  }

  function discardChanges() {
    setDiscardChangesOpen(false);
    stateRef.current.onClose();
  }

  useEffect(() => {
    if (!open || !mounted) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ?? dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? dialogRef.current)?.focus();
    });
    function handleKeyDown(event: KeyboardEvent) {
      const state = stateRef.current;
      if (event.key === "Escape" && state.closeOnEscape) {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, mounted]);

  if (!rendered || !mounted) return null;
  const style = { ...(accentColor ? { "--popup-modal-accent": accentColor } : {}), ...(exiting ? { animation: "popup-modal-exit 180ms ease-in both" } : {}) } as CSSProperties;
  className = `${className} ${exiting ? "popup-modal-exiting" : ""}`.trim();
  return <>
    {createPortal(<PopupModalLayerContext.Provider value><div className="dialog-backdrop popup-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && stateRef.current.closeOnBackdrop) requestClose(); }}><section ref={dialogRef} className={`dialog popup-modal popup-modal-size-${size} popup-modal-tone-${tone} ${className}`.trim()} style={style} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}><header className="popup-modal-header"><div className="popup-modal-heading">{icon && <span className="popup-modal-icon" aria-hidden="true">{icon}</span>}<div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId} className="popup-modal-description">{description}</p>}</div></div>{(headerActions || showCloseButton) && <div className="popup-modal-header-actions">{headerActions}{showCloseButton && <button className="popup-modal-close dialog-close" type="button" aria-label={closeLabel} onClick={(event) => { event.preventDefault(); event.stopPropagation(); requestClose(); }}><Icon name="close" size={17} /></button>}</div>}</header><div className={`popup-modal-body ${bodyClassName}`.trim()}>{children}</div>{footer && <footer className="popup-modal-footer">{footer}</footer>}</section></div></PopupModalLayerContext.Provider>, document.body)}
    {discardChangesOpen && <PopupModal open title="You have unsaved changes" description="Any changes you made will be lost. Discard them?" size="sm" tone="danger" onClose={() => setDiscardChangesOpen(false)} closeOnBackdrop={false} footer={<div className="dialog-actions"><button className="button button-secondary" type="button" onClick={() => setDiscardChangesOpen(false)}>Keep Editing</button><button className="button button-danger" type="button" onClick={discardChanges}>Discard Changes</button></div>} />}
  </>;
}
