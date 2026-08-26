export const reportingPeriodIds = ["30d", "90d", "365d", "all"] as const;

export type ReportingPeriod = (typeof reportingPeriodIds)[number];

export const defaultReportingPeriod: ReportingPeriod = "90d";
export const allTimeStartIso = "2020-01-01T00:00:00.000Z";

type ReportingPeriodDefinition = {
  id: ReportingPeriod;
  label: string;
  shortLabel: string;
  description: string;
  days: number | null;
};

export const reportingPeriods: readonly ReportingPeriodDefinition[] = [
  {
    id: "30d",
    label: "30 days",
    shortLabel: "30D",
    description: "30 completed UTC days, ending yesterday",
    days: 30,
  },
  {
    id: "90d",
    label: "90 days",
    shortLabel: "90D",
    description: "90 completed UTC days, ending yesterday",
    days: 90,
  },
  {
    id: "365d",
    label: "12 months",
    shortLabel: "12M",
    description: "365 completed UTC days, ending yesterday",
    days: 365,
  },
  {
    id: "all",
    label: "All time",
    shortLabel: "ALL",
    description: "All available history since January 2020",
    days: null,
  },
];

export function isReportingPeriod(value: unknown): value is ReportingPeriod {
  return reportingPeriodIds.includes(value as ReportingPeriod);
}

export function getReportingPeriodDefinition(period: ReportingPeriod) {
  return reportingPeriods.find((candidate) => candidate.id === period)!;
}

export function getReportingWindow(
  period: ReportingPeriod = defaultReportingPeriod,
  now = new Date(),
) {
  const periodEnd = new Date(now);
  periodEnd.setUTCHours(0, 0, 0, 0);

  const definition = getReportingPeriodDefinition(period);
  const periodStart = definition.days === null
    ? new Date(allTimeStartIso)
    : new Date(periodEnd.getTime() - definition.days * 24 * 60 * 60 * 1000);

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

export function getSubscriptionMonthLimit(
  period: ReportingPeriod,
  now = new Date(),
) {
  if (period === "30d") return 1;
  if (period === "90d") return 3;
  if (period === "365d") return 12;

  const { periodStart, periodEnd } = getReportingWindow(period, now);
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const calendarMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + end.getUTCMonth() - start.getUTCMonth();

  // Include the current billing month when the all-time window reaches into it.
  return Math.max(1, calendarMonths + (end.getUTCDate() > start.getUTCDate() ? 1 : 0));
}

export function inferReportingPeriod(
  periodStart: string,
  periodEnd: string,
): ReportingPeriod {
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return defaultReportingPeriod;
  }

  const dayCount = Math.round((end - start) / (24 * 60 * 60 * 1000));
  if (start <= new Date(allTimeStartIso).getTime() + 24 * 60 * 60 * 1000) return "all";
  if (dayCount === 30) return "30d";
  if (dayCount === 365) return "365d";
  return "90d";
}

export function reportingPeriodLabelFromWindow(
  periodStart: string,
  periodEnd: string,
) {
  return getReportingPeriodDefinition(
    inferReportingPeriod(periodStart, periodEnd),
  ).label;
}

export function reportingPeriodShortLabelFromWindow(
  periodStart: string,
  periodEnd: string,
) {
  return getReportingPeriodDefinition(
    inferReportingPeriod(periodStart, periodEnd),
  ).shortLabel;
}
