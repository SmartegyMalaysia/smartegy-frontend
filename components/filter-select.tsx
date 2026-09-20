"use client";

import { createPortal } from "react-dom";
import { useContext, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Icon } from "@/components/icons";
import { FormField } from "./form-controls";
import { PopupModalLayerContext } from "./popup-modal";

type MenuPosition = { top: number; left: number; width: number };
function titleCaseOption(value: string) { return value.replaceAll("_", " ").replace(/\b[a-z]/g, (character) => character.toUpperCase()); }

export function FilterSelect<T extends string>({ id, allLabel, title, value, options, onChange, labels, disabled = false, ariaLabel, ariaInvalid = false, required = false }: { id?: string; allLabel: string; title?: string; value: T; options: T[]; onChange: (value: T) => void; labels?: Partial<Record<T, string>>; disabled?: boolean; ariaLabel?: string; ariaInvalid?: boolean; required?: boolean }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeaheadRef = useRef({ value: "", updatedAt: 0 });
  const popoverId = useRef({});
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuExiting, setMenuExiting] = useState(false);
  const insidePopupModal = useContext(PopupModalLayerContext);
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
  function labelFor(option: T) { const label = labels?.[option] ?? (option === "" || option === "all" ? allLabel : option); return titleCaseOption(label); }
  function handleTypeahead(event: ReactKeyboardEvent<HTMLDetailsElement>) {
    if (!detailsRef.current?.open || event.key.length !== 1 || event.key === " " || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLocaleLowerCase();
    const now = Date.now();
    const previous = now - typeaheadRef.current.updatedAt <= 700 ? typeaheadRef.current.value : "";
    const combined = `${previous}${key}`;
    const repeatedCharacter = combined.length > 1 && combined.split("").every((character) => character === combined[0]);
    let query = repeatedCharacter ? key : combined;
    const currentIndex = optionRefs.current.findIndex((option) => option === document.activeElement);
    let startIndex = repeatedCharacter && currentIndex >= 0 ? currentIndex + 1 : 0;
    const findMatch = (search: string, start: number) => {
      for (let offset = 0; offset < options.length; offset += 1) {
        const index = (start + offset) % options.length;
        if (labelFor(options[index]).trim().toLocaleLowerCase().startsWith(search)) return index;
      }
      return -1;
    };
    let matchIndex = findMatch(query, startIndex);
    if (matchIndex < 0 && previous && !repeatedCharacter) {
      query = key;
      startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
      matchIndex = findMatch(query, startIndex);
    }
    typeaheadRef.current = { value: query, updatedAt: now };
    const match = optionRefs.current[matchIndex];
    if (!match) return;
    event.preventDefault();
    match.focus({ preventScroll: true });
    match.scrollIntoView({ block: "nearest" });
  }
  const menu = <div className={`filter-select-menu filter-select-menu-portal ${insidePopupModal ? "popup-modal-popover" : ""} ${menuExiting ? "filter-select-menu-exiting" : ""}`.trim()} role="listbox" aria-label={allLabel} style={menuPosition ? { top: menuPosition.top, left: menuPosition.left, width: menuPosition.width } : undefined}>{options.map((option, index) => <button key={option} ref={(node) => { optionRefs.current[index] = node; }} type="button" role="option" aria-selected={option === value} className={option === value ? "filter-option-selected" : ""} onClick={() => { onChange(option); if (detailsRef.current) detailsRef.current.open = false; setOpen(false); }}>{labelFor(option)}</button>)}</div>;
  const select = <details className={`filter-select ${disabled ? "filter-select-disabled" : ""}`} ref={detailsRef} open={disabled ? false : open} onKeyDown={handleTypeahead} onToggle={(event) => { const isOpen = event.currentTarget.open; if (disabled && isOpen) { event.currentTarget.open = false; return; } setOpen(isOpen); if (isOpen) { typeaheadRef.current = { value: "", updatedAt: 0 }; window.dispatchEvent(new CustomEvent("smartegy:popover-open", { detail: popoverId.current })); } }}><summary id={id} ref={summaryRef} aria-label={ariaLabel} aria-invalid={ariaInvalid} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled) event.preventDefault(); }}><span className="filter-select-value">{labelFor(value)}</span><Icon name="chevron" size={14} /></summary>{menuMounted && !disabled && menuPosition && typeof document !== "undefined" ? createPortal(menu, document.body) : null}</details>;
  return title ? <FormField title={title} required={required}>{select}</FormField> : select;
}
