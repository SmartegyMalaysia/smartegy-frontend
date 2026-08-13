"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

export function FilterSelect<T extends string>({ allLabel, value, options, onChange, labels }: { allLabel: string; value: T; options: T[]; onChange: (value: T) => void; labels?: Partial<Record<T, string>> }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const popoverId = useRef({});
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const closeOtherPopover = (event: Event) => { if ((event as CustomEvent).detail !== popoverId.current) setOpen(false); };
    window.addEventListener("smartegy:popover-open", closeOtherPopover);
    return () => window.removeEventListener("smartegy:popover-open", closeOtherPopover);
  }, []);
  function labelFor(option: T) { return labels?.[option] ?? (option === "all" ? allLabel : option.replaceAll("_", " ")); }
  const rect = summaryRef.current?.getBoundingClientRect();
  const menuWidth = 180;
  const viewportWidth = typeof document === "undefined" ? menuWidth + 32 : document.documentElement.clientWidth;
  const menuLeft = rect ? Math.max(16, Math.min(rect.left, viewportWidth - menuWidth - 16)) : undefined;
  const menu = <div className="filter-select-menu filter-select-menu-portal" role="listbox" aria-label={allLabel} style={rect ? { top: rect.bottom + 6, left: menuLeft, width: menuWidth } : undefined}>{options.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} className={option === value ? "filter-option-selected" : ""} onClick={() => { onChange(option); if (detailsRef.current) detailsRef.current.open = false; setOpen(false); }}>{labelFor(option)}</button>)}</div>;
  return <details className="filter-select" ref={detailsRef} open={open} onToggle={(event) => { const isOpen = event.currentTarget.open; setOpen(isOpen); if (isOpen) window.dispatchEvent(new CustomEvent("smartegy:popover-open", { detail: popoverId.current })); }}><summary ref={summaryRef}><span className="filter-select-value">{labelFor(value)}</span><Icon name="chevron" size={14} /></summary>{open && typeof document !== "undefined" ? createPortal(menu, document.body) : null}</details>;
}
