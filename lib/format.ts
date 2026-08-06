import type { MoneySen } from "./types";

export const formatMoney = (sen: MoneySen | null) => sen === null ? "—" : new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 }).format(sen / 100);
export const formatDate = (value: string) => new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(value));
export const titleCase = (value: string) => value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
