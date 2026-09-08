import type { ProposalEnergyReading, ProposalInput } from "./types";

export interface ProposalCalculationPreview {
  saleAmountSen: number;
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

const roundCents = (value: number) => Math.round(value);
const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

export function calculateProposalPreview(input: Pick<ProposalInput, "saleAmountSen" | "readings">): ProposalCalculationPreview | null {
  if (input.readings.length !== 12 || input.saleAmountSen <= 0 || input.readings.some((reading) => reading.tnbRate < 0 || reading.kwhUsed < 0 || reading.billAmountSen < 0 || reading.operationDays < 1 || reading.operationDays > 31)) return null;
  const avgRate = round(input.readings.reduce((sum, reading) => sum + reading.tnbRate, 0) / 12, 6);
  const avgKwh = round(input.readings.reduce((sum, reading) => sum + reading.kwhUsed, 0) / 12, 3);
  const avgBillSen = roundCents(input.readings.reduce((sum, reading) => sum + reading.billAmountSen, 0) / 12);
  const avgDayKwh = round(input.readings.reduce((sum, reading) => sum + (reading.dailyKwh ?? round(reading.kwhUsed / reading.operationDays, 3)), 0) / 12, 3);
  const savingKwhMonth = round(avgKwh * 0.08, 3);
  const savingRmMonthSen = roundCents(avgBillSen * 0.08);
  const deposit1Sen = savingRmMonthSen;
  const deposit2Sen = roundCents(savingRmMonthSen * 2);
  const downpaymentTotalSen = deposit1Sen + deposit2Sen;
  const balanceSen = input.saleAmountSen - downpaymentTotalSen;
  if (balanceSen < 0) return null;
  return {
    saleAmountSen: input.saleAmountSen,
    deposit1Sen,
    deposit2Sen,
    downpaymentTotalSen,
    balanceSen,
    option1MonthlySen: roundCents(balanceSen / 10),
    option2MonthlySen: roundCents(balanceSen / 20),
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
  return Array.from({ length: 12 }, (_, index) => ({
    sequence: index + 1,
    month: `Month ${index + 1}`,
    tnbRate: 0,
    kwhUsed: 0,
    billAmountSen: 0,
    operationDays: 30,
  }));
}
