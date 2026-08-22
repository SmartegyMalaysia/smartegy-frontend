"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { FormField } from "./form-controls";

type DatePickerMode = "date" | "month";
export type DateRangeValue = { start: string; end: string };

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function CalendarIcon() { return <svg aria-hidden="true" className="date-picker-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>; }
function initialDate(value: string, mode: DatePickerMode) { if (value) { const [year, month, day] = value.split("-").map(Number); return new Date(Date.UTC(year, month - 1, mode === "date" ? day ?? 1 : 1)); } const today = new Date(); return new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)); }

export function DatePicker({ id, title, value, mode = "date", placeholder, surface = "subtle", onChange, required = false, ariaLabel, displayValueOverride, range, onRangeChange }: { id: string; title?: string; value: string; mode?: DatePickerMode; placeholder?: string; surface?: "subtle" | "white"; onChange: (value: string) => void; required?: boolean; ariaLabel?: string; displayValueOverride?: string; range?: DateRangeValue; onRangeChange?: (value: DateRangeValue) => void }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const popoverId = useRef({});
  const [viewDate, setViewDate] = useState(() => initialDate(value, mode));
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const closeOtherPopover = (event: Event) => { if ((event as CustomEvent).detail !== popoverId.current) { setOpen(false); setYearPickerOpen(false); } };
    window.addEventListener("smartegy:popover-open", closeOtherPopover);
    return () => window.removeEventListener("smartegy:popover-open", closeOtherPopover);
  }, []);
  const year = viewDate.getUTCFullYear();
  const month = viewDate.getUTCMonth();
  const rangeMode = Boolean(range && onRangeChange);
  const displayValue = displayValueOverride ?? (value ? mode === "month" ? `${value.slice(5, 7)}/${value.slice(0, 4)}` : `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : placeholder ?? (mode === "month" ? "MM/YYYY" : "DD/MM/YYYY"));
  const years = Array.from({ length: 12 }, (_, index) => year - 5 + index);
  function close() { setOpen(false); setYearPickerOpen(false); if (detailsRef.current) detailsRef.current.open = false; }
  function moveMonth(amount: number) { setViewDate((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1))); }
  function moveYear(amount: number) { setViewDate((current) => new Date(Date.UTC(current.getUTCFullYear() + amount, current.getUTCMonth(), 1))); }
  function selectYear(selectedYear: number) { setViewDate(new Date(Date.UTC(selectedYear, month, 1))); setYearPickerOpen(false); }
  function selectMonth(selectedMonth: number) { onChange(`${year}-${String(selectedMonth + 1).padStart(2, "0")}`); close(); }
  function selectDay(day: number) {
    const selected = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!rangeMode || !range || !onRangeChange) { onChange(selected); close(); return; }
    if (!range.start || range.end) { onRangeChange({ start: selected, end: "" }); return; }
    onRangeChange(selected < range.start ? { start: selected, end: range.start } : { start: range.start, end: selected });
    close();
  }
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = Array.from({ length: mode === "date" ? Math.ceil((firstDay + daysInMonth) / 7) * 7 : 0 }, (_, index) => { const day = index - firstDay + 1; return day > 0 && day <= daysInMonth ? day : null; });
  const rect = summaryRef.current?.getBoundingClientRect();
  const popover = <div className="date-picker-popover date-picker-portal" role="dialog" aria-label={rangeMode ? "Choose date range" : mode === "month" ? "Choose payment month" : "Choose date"} style={rect ? { top: rect.bottom + 8, left: rect.left } : undefined}>
    <div className="date-picker-toolbar"><button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>&lsaquo;</button><div className="date-picker-toolbar-heading"><span>{monthNames[month]}</span><button className="date-picker-year-trigger" type="button" aria-expanded={yearPickerOpen} onClick={() => setYearPickerOpen((current) => !current)}>{year}</button></div><button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>&rsaquo;</button></div>
    {yearPickerOpen ? <div className="date-picker-year-picker" aria-label="Choose year"><div className="date-picker-year-toolbar"><button type="button" aria-label="Previous year range" onClick={() => moveYear(-12)}>&lsaquo;</button><span>{years[0]}&ndash;{years[years.length - 1]}</span><button type="button" aria-label="Next year range" onClick={() => moveYear(12)}>&rsaquo;</button></div><div className="date-picker-year-grid">{years.map((option) => <button className={option === year ? "date-picker-selected" : ""} key={option} type="button" onClick={() => selectYear(option)}>{option}</button>)}</div></div> : mode === "month" ? <div className="date-picker-month-grid">{shortMonthNames.map((name, index) => <button className={value === `${year}-${String(index + 1).padStart(2, "0")}` ? "date-picker-selected" : ""} key={name} type="button" onClick={() => selectMonth(index)}>{name}</button>)}</div> : <div className="date-picker-day-grid">{weekDays.map((day) => <span className="date-picker-weekday" key={day}>{day}</span>)}{days.map((day, index) => { if (!day) return <span key={index}/>; const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const isRangeStart = rangeMode && range?.start === date; const isRangeEnd = rangeMode && range?.end === date; const isInRange = rangeMode && Boolean(range?.start && range?.end && date > range.start && date < range.end); const dayClassName = rangeMode ? [isRangeStart || isRangeEnd ? "date-picker-selected" : "", isRangeStart ? "date-picker-range-start" : "", isRangeEnd ? "date-picker-range-end" : "", isInRange ? "date-picker-in-range" : ""].filter(Boolean).join(" ") : value === date ? "date-picker-selected" : ""; return <button className={dayClassName} key={index} type="button" onClick={() => selectDay(day)}>{day}</button>; })}</div>}
  </div>;
  const picker = <details id={id} className={`date-picker date-picker-${surface}`} ref={detailsRef} open={open} onToggle={(event) => { const isOpen = event.currentTarget.open; setOpen(isOpen); if (isOpen) window.dispatchEvent(new CustomEvent("smartegy:popover-open", { detail: popoverId.current })); }}><summary ref={summaryRef} aria-label={ariaLabel ?? `${mode === "month" ? "Payment month" : "Date"}: ${displayValue}`}><span className={value || (rangeMode && range?.end) ? "date-picker-value" : "date-picker-placeholder"}>{displayValue}</span><span className="date-picker-icon"><CalendarIcon /></span></summary>{open && typeof document !== "undefined" ? createPortal(popover, document.body) : null}</details>;
  return title ? <FormField title={title} htmlFor={id} required={required}>{picker}</FormField> : picker;
}
