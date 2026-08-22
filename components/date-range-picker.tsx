"use client";

import { DatePicker, type DateRangeValue } from "./date-picker";
import { useEffect, useState } from "react";

function displayDate(value: string) { return value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : ""; }

export function DateRangePicker({ id, title, from, to, onFromChange, onToChange }: { id: string; title: string; from: string; to: string; onFromChange: (value: string) => void; onToChange: (value: string) => void }) {
  const labelId = `${id}-label`;
  const [draftRange, setDraftRange] = useState<DateRangeValue>({ start: from, end: to });
  useEffect(() => { setDraftRange({ start: from, end: to }); }, [from, to]);
  const displayValue = draftRange.start && draftRange.end ? `${displayDate(draftRange.start)} – ${displayDate(draftRange.end)}` : draftRange.start ? `${displayDate(draftRange.start)} – Select end` : "Select date range";
  function updateRange(next: DateRangeValue) {
    setDraftRange(next);
    if (next.start && next.end) { onFromChange(next.start); onToChange(next.end); }
  }
  return <div className="date-range-picker" role="group" aria-labelledby={labelId}>
    <span id={labelId} className="date-range-picker-label">{title}</span>
    <DatePicker id={id} value={draftRange.start} placeholder="Select date range" displayValueOverride={displayValue} ariaLabel={`${title}: ${displayValue}`} range={draftRange} onRangeChange={updateRange} onChange={() => undefined} />
  </div>;
}
