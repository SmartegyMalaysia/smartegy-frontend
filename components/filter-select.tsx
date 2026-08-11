"use client";

import { useRef } from "react";
import { Icon } from "@/components/icons";

export function FilterSelect<T extends string>({ allLabel, value, options, onChange, labels }: { allLabel: string; value: T; options: T[]; onChange: (value: T) => void; labels?: Partial<Record<T, string>> }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  function labelFor(option: T) { return labels?.[option] ?? (option === "all" ? allLabel : option.replaceAll("_", " ")); }
  return <details className="filter-select" ref={detailsRef}><summary><strong>{labelFor(value)}</strong><Icon name="chevron" size={14} /></summary><div className="filter-select-menu" role="listbox" aria-label={allLabel}>{options.map((option) => <button key={option} type="button" role="option" aria-selected={option === value} className={option === value ? "filter-option-selected" : ""} onClick={() => { onChange(option); if (detailsRef.current) detailsRef.current.open = false; }}>{labelFor(option)}</button>)}</div></details>;
}
