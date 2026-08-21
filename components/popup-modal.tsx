"use client";

import { useEffect, useId, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

export type PopupModalSize = "sm" | "md" | "lg";
export type PopupModalTone = "brand" | "danger" | "success" | "neutral";

export type PopupModalProps = {
  open: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
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
  const stateRef = useRef({ onClose, closeOnEscape, closeOnBackdrop, hasUnsavedChanges, unsavedChangesMessage });

  useEffect(() => {
    stateRef.current = { onClose, closeOnEscape, closeOnBackdrop, hasUnsavedChanges, unsavedChangesMessage };
  }, [onClose, closeOnEscape, closeOnBackdrop, hasUnsavedChanges, unsavedChangesMessage]);

  function requestClose() {
    const state = stateRef.current;
    if (state.hasUnsavedChanges && !window.confirm(state.unsavedChangesMessage)) return;
    state.onClose();
  }

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;
  const style = accentColor ? { "--popup-modal-accent": accentColor } as CSSProperties : undefined;
  return <div className="dialog-backdrop popup-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && stateRef.current.closeOnBackdrop) requestClose(); }}><section ref={dialogRef} className={`dialog popup-modal popup-modal-size-${size} popup-modal-tone-${tone} ${className}`.trim()} style={style} role="dialog" aria-modal="true" aria-labelledby="popup-modal-title" aria-describedby={description ? "popup-modal-description" : undefined} tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}><header className="popup-modal-header"><div className="popup-modal-heading">{icon && <span className="popup-modal-icon" aria-hidden="true">{icon}</span>}<div><h2 id="popup-modal-title">{title}</h2>{description && <p id="popup-modal-description" className="popup-modal-description">{description}</p>}</div></div>{showCloseButton && <button className="popup-modal-close dialog-close" type="button" aria-label={closeLabel} onClick={(event) => { event.preventDefault(); event.stopPropagation(); requestClose(); }}>×</button>}</header><div className={`popup-modal-body ${bodyClassName}`.trim()}>{children}</div>{footer && <footer className="popup-modal-footer">{footer}</footer>}</section></div>;
}
