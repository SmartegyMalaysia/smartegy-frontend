"use client";

import { useRef, useState } from "react";

type DatePickerMode = "date" | "month";
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function initialDate(value: string, mode: DatePickerMode) {
  if (value) { const [year, month, day] = value.split("-").map(Number); return new Date(Date.UTC(year, month - 1, mode === "date" ? day ?? 1 : 1)); }
  const today = new Date();
  return new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
}

export function DatePicker({ id, value, mode = "date", placeholder, onChange }: { id: string; value: string; mode?: DatePickerMode; placeholder?: string; onChange: (value: string) => void }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [viewDate, setViewDate] = useState(() => initialDate(value, mode));
  const year = viewDate.getUTCFullYear();
  const month = viewDate.getUTCMonth();
  const displayValue = value ? mode === "month" ? `${value.slice(5, 7)}/${value.slice(0, 4)}` : `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : placeholder ?? (mode === "month" ? "MM/YYYY" : "DD/MM/YYYY");
  function close() { if (detailsRef.current) detailsRef.current.open = false; }
  function moveMonth(amount: number) { setViewDate((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1))); }
  function selectMonth(selectedMonth: number) { onChange(`${year}-${String(selectedMonth + 1).padStart(2, "0")}`); close(); }
  function selectDay(day: number) { onChange(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`); close(); }
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = Array.from({ length: mode === "date" ? Math.ceil((firstDay + daysInMonth) / 7) * 7 : 0 }, (_, index) => { const day = index - firstDay + 1; return day > 0 && day <= daysInMonth ? day : null; });
  return <details className="date-picker" ref={detailsRef}><summary aria-label={`${mode === "month" ? "Payment month" : "Date"}: ${displayValue}`}><span className={value ? "date-picker-value" : "date-picker-placeholder"}>{displayValue}</span><span className="date-picker-icon" aria-hidden="true">▣</span></summary><div className="date-picker-popover" role="dialog" aria-label={mode === "month" ? "Choose payment month" : "Choose date"}><div className="date-picker-toolbar"><button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button><strong>{monthNames[month]} {year}</strong><button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>›</button></div>{mode === "month" ? <div className="date-picker-month-grid">{shortMonthNames.map((name, index) => <button className={value === `${year}-${String(index + 1).padStart(2, "0")}` ? "date-picker-selected" : ""} key={name} type="button" onClick={() => selectMonth(index)}>{name}</button>)}</div> : <div className="date-picker-day-grid">{weekDays.map((day) => <span className="date-picker-weekday" key={day}>{day}</span>)}{days.map((day, index) => day ? <button className={value === `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` ? "date-picker-selected" : ""} key={index} type="button" onClick={() => selectDay(day)}>{day}</button> : <span key={index}/>)}</div>}</div></details>;
}
