"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { FormField } from "./form-controls";

type MenuPosition = { top: number; left: number; width: number };

export function FilterSelect<T extends string>({ allLabel, title, value, options, onChange, labels, disabled = false, ariaLabel, required = false }: { allLabel: string; title?: string; value: T; options: T[]; onChange: (value: T) => void; labels?: Partial<Record<T, string>>; disabled?: boolean; ariaLabel?: string; required?: boolean }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const popoverId = useRef({});
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuExiting, setMenuExiting] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const closeOtherPopover = (event: Event) => { if ((event as CustomEvent).detail !== popoverId.current) setOpen(false); };
    window.addEventListener("smartegy:popover-open", closeOtherPopover);
    return () => window.removeEventListener("smartegy:popover-open", closeOtherPopover);
  }, []);
  useEffect(() => {
    if (!open) {
      if (!menuMounted) { setMenuPosition(null); return; }
      setMenuExiting(true);
      closeTimerRef.current = window.setTimeout(() => {
        setMenuMounted(false);
        setMenuExiting(false);
        setMenuPosition(null);
        closeTimerRef.current = null;
      }, 140);
      return () => {
        if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      };
    }
    setMenuMounted(true);
    setMenuExiting(false);
    const updateMenuPosition = () => {
      const rect = summaryRef.current?.getBoundingClientRect();
      if (!rect) return;
      const availableWidth = Math.max(0, window.innerWidth - 32);
      const width = Math.min(Math.max(rect.width, 150), availableWidth);
      const maxLeft = Math.max(16, window.innerWidth - width - 16);
      setMenuPosition({ top: rect.bottom + 6, left: Math.min(Math.max(rect.left, 16), maxLeft), width });
    };
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, [open, menuMounted]);
  function labelFor(option: T) { return labels?.[option] ?? (option === "" || option === "all" ? allLabel : option.replaceAll("_", " ")); }
  const menu = <div className={`filter-select-menu filter-select-menu-portal ${menuExiting ? "filter-select-menu-exiting" : ""}`.trim()} role="listbox" aria-label={allLabel} style={menuPosition ? { top: menuPosition.top, left: menuPosition.left, width: menuPosition.width } : undefined}>{options.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} className={option === value ? "filter-option-selected" : ""} onClick={() => { onChange(option); if (detailsRef.current) detailsRef.current.open = false; setOpen(false); }}>{labelFor(option)}</button>)}</div>;
  const select = <details className={`filter-select ${disabled ? "filter-select-disabled" : ""}`} ref={detailsRef} open={disabled ? false : open} onToggle={(event) => { const isOpen = event.currentTarget.open; if (disabled && isOpen) { event.currentTarget.open = false; return; } setOpen(isOpen); if (isOpen) window.dispatchEvent(new CustomEvent("smartegy:popover-open", { detail: popoverId.current })); }}><summary ref={summaryRef} aria-label={ariaLabel} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled) event.preventDefault(); }}><span className="filter-select-value">{labelFor(value)}</span><Icon name="chevron" size={14} /></summary>{menuMounted && !disabled && menuPosition && typeof document !== "undefined" ? createPortal(menu, document.body) : null}</details>;
  return title ? <FormField title={title} required={required}>{select}</FormField> : select;
}
