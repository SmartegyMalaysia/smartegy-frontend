"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";

export function FilterSelect<T extends string>({ allLabel, value, options, onChange, labels, disabled = false, ariaLabel }: { allLabel: string; value: T; options: T[]; onChange: (value: T) => void; labels?: Partial<Record<T, string>>; disabled?: boolean; ariaLabel?: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const popoverId = useRef({});
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const closeOtherPopover = (event: Event) => { if ((event as CustomEvent).detail !== popoverId.current) setOpen(false); };
    window.addEventListener("smartegy:popover-open", closeOtherPopover);
    return () => window.removeEventListener("smartegy:popover-open", closeOtherPopover);
  }, []);
  function labelFor(option: T) { return labels?.[option] ?? (option === "" || option === "all" ? allLabel : option.replaceAll("_", " ")); }
  const menu = <div className="filter-select-menu" role="listbox" aria-label={allLabel}>{options.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} className={option === value ? "filter-option-selected" : ""} onClick={() => { onChange(option); if (detailsRef.current) detailsRef.current.open = false; setOpen(false); }}>{labelFor(option)}</button>)}</div>;
  return <details className={`filter-select ${disabled ? "filter-select-disabled" : ""}`} ref={detailsRef} open={disabled ? false : open} onToggle={(event) => { const isOpen = event.currentTarget.open; if (disabled && isOpen) { event.currentTarget.open = false; return; } setOpen(isOpen); if (isOpen) window.dispatchEvent(new CustomEvent("smartegy:popover-open", { detail: popoverId.current })); }}><summary aria-label={ariaLabel} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled) event.preventDefault(); }}><span className="filter-select-value">{labelFor(value)}</span><Icon name="chevron" size={14} /></summary>{open && !disabled ? menu : null}</details>;
}
