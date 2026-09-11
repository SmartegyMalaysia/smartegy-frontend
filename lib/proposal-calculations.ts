import type { ProposalEnergyReading, ProposalInput } from "./types";

type ProposalCalculationInput = Pick<ProposalInput, "saleAmountSen" | "readings"> & {
  /** Temporary frontend compatibility until ProposalInput is updated. */
  downpaymentSen?: number | null;
};

export interface ProposalCalculationPreview {
  saleAmountSen: number;
  calculatedDownpaymentSen: number;
  downpaymentSen: number;
  postInstallationSen: number;
  financingInterestSen: number;
  option1TotalSen: number;
  option2TotalSen: number;
  // Legacy aliases retained for existing consumers until they are migrated.
  deposit1Sen: number;
  deposit2Sen: number;
  downpaymentTotalSen: number;
  balanceSen: number;
  option1MonthlySen: number;
  option2MonthlySen: number;
  avgRate: number;
  avgKwh: number;
  avgBillSen: number;
  avgDayKwh: number;
  beforeInstallKwh: number;
  afterInstallKwh: number;
  savingKwhMonth: number;
  savingRmMonthSen: number;
  savingRmYearSen: number;
  savingRm2YSen: number;
  savingRm15YSen: number;
}

const MAX_PROPOSAL_READINGS = 12;
const SAVING_RATE = 0.08;
const FINANCING_INTEREST_RATE = 0.1;

const roundCents = (value: number) => Math.round(value);
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

export function calendarDaysForMonth(month: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || monthNumber < 1 || monthNumber > 12) return null;
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export function isCompletedHistoricalMonth(month: string, today = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match || calendarDaysForMonth(month) === null) return false;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  return year < today.getFullYear() || (year === today.getFullYear() && monthNumber <= today.getMonth());
}

export function calculateProposalPreview(input: ProposalCalculationInput): ProposalCalculationPreview | null {
  if (!Number.isInteger(input.saleAmountSen) || input.saleAmountSen <= 0 || !Array.isArray(input.readings) || input.readings.length < 1 || input.readings.length > MAX_PROPOSAL_READINGS) return null;

  const months = new Set<string>();
  const normalizedReadings = input.readings.map((reading) => {
    const operationDays = calendarDaysForMonth(reading.month);
    if (operationDays === null || !isCompletedHistoricalMonth(reading.month) || months.has(reading.month)) return null;
    months.add(reading.month);
    if (!Number.isFinite(reading.billAmountSen) || !Number.isInteger(reading.billAmountSen) || reading.billAmountSen <= 0) return null;
    if (!Number.isFinite(reading.kwhUsed) || reading.kwhUsed <= 0 || reading.operationDays !== operationDays) return null;
    const tnbRate = reading.billAmountSen / 100 / reading.kwhUsed;
    const dailyKwh = reading.kwhUsed / operationDays;
    if (!Number.isFinite(tnbRate) || !Number.isFinite(dailyKwh)) return null;
    return { ...reading, tnbRate, operationDays, dailyKwh };
  });
  if (normalizedReadings.some((reading) => reading === null)) return null;

  const readings = normalizedReadings as Array<ProposalEnergyReading & { dailyKwh: number }>;
  const readingCount = readings.length;
  const avgRate = round(readings.reduce((sum, reading) => sum + reading.tnbRate, 0) / readingCount, 6);
  const avgKwh = round(readings.reduce((sum, reading) => sum + reading.kwhUsed, 0) / readingCount, 3);
  const avgBillSen = roundCents(readings.reduce((sum, reading) => sum + reading.billAmountSen, 0) / readingCount);
  const avgDayKwh = round(readings.reduce((sum, reading) => sum + reading.dailyKwh, 0) / readingCount, 3);
  const savingKwhMonth = round(avgKwh * SAVING_RATE, 3);
  const savingRmMonthSen = roundCents(avgBillSen * SAVING_RATE);
  const calculatedDownpaymentSen = roundCents(Math.max(...readings.map((reading) => reading.billAmountSen)) * SAVING_RATE);
  const downpaymentSen = input.downpaymentSen == null ? calculatedDownpaymentSen : roundCents(input.downpaymentSen);
  if (!Number.isFinite(downpaymentSen) || downpaymentSen < 0) return null;
  const postInstallationSen = roundCents(downpaymentSen * 2);
  const downpaymentTotalSen = downpaymentSen + postInstallationSen;
  const balanceSen = input.saleAmountSen - downpaymentTotalSen;
  if (balanceSen < 0) return null;
  const financingInterestSen = roundCents(input.saleAmountSen * FINANCING_INTEREST_RATE);
  const option1TotalSen = balanceSen;
  const option2TotalSen = balanceSen + financingInterestSen;

  return {
    saleAmountSen: input.saleAmountSen,
    calculatedDownpaymentSen,
    downpaymentSen,
    postInstallationSen,
    financingInterestSen,
    option1TotalSen,
    option2TotalSen,
    deposit1Sen: downpaymentSen,
    deposit2Sen: postInstallationSen,
    downpaymentTotalSen,
    balanceSen,
    option1MonthlySen: roundCents(option1TotalSen / 10),
    option2MonthlySen: roundCents(option2TotalSen / 20),
    avgRate,
    avgKwh,
    avgBillSen,
    avgDayKwh,
    beforeInstallKwh: avgKwh,
    afterInstallKwh: round(avgKwh - savingKwhMonth, 3),
    savingKwhMonth,
    savingRmMonthSen,
    savingRmYearSen: savingRmMonthSen * 12,
    savingRm2YSen: savingRmMonthSen * 24,
    savingRm15YSen: savingRmMonthSen * 180,
  };
}

export function emptyProposalReadings(): ProposalEnergyReading[] {
  return [{ sequence: 1, month: "", tnbRate: 0, kwhUsed: 0, billAmountSen: 0, operationDays: 0 }];
}
