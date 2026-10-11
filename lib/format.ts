import type { MoneySen } from "./types";

export const formatMoney = (sen: MoneySen | null) => sen === null ? "—" : new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 }).format(sen / 100);
const displayTimeZone = "Asia/Kuala_Lumpur";
const datePartFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: displayTimeZone });
const dateTimePartFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: displayTimeZone });
const isoDatePartFormatter = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: displayTimeZone });
function dateParts(formatter: Intl.DateTimeFormat, value: string) {
  return Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
}
function isoDateParts(value: Date) {
  return Object.fromEntries(isoDatePartFormatter.formatToParts(value).map((part) => [part.type, part.value]));
}
export const todayISODate = () => {
  const parts = isoDateParts(new Date());
  return `${parts.year}-${parts.month}-${parts.day}`;
};
export const addISODateDays = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export const formatDate = (value: string) => {
  const parts = dateParts(datePartFormatter, value);
  return `${parts.day}/${parts.month}/${parts.year}`;
};
export const formatDateTime = (value: string) => {
  const parts = dateParts(dateTimePartFormatter, value);
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
};
export const titleCase = (value: string) => value.split(/[\s_]+/).map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word).join(" ");
export const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
