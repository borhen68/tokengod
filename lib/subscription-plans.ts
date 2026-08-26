import {
  defaultReportingPeriod,
  getSubscriptionMonthLimit,
  type ReportingPeriod,
} from "@/lib/reporting-period";

export const subscriptionPlanIds = [
  "claude-pro",
  "claude-max-5x",
  "claude-max-20x",
  "chatgpt-plus",
  "chatgpt-pro",
] as const;

export type SubscriptionPlanId = (typeof subscriptionPlanIds)[number];
export type SubscriptionProvider = "anthropic" | "openai";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  provider: SubscriptionProvider;
  monthlyUsd: number;
};

export const subscriptionPlans: readonly SubscriptionPlan[] = [
  { id: "claude-pro", name: "Claude Pro", provider: "anthropic", monthlyUsd: 20 },
  { id: "claude-max-5x", name: "Claude Max 5×", provider: "anthropic", monthlyUsd: 100 },
  { id: "claude-max-20x", name: "Claude Max 20×", provider: "anthropic", monthlyUsd: 200 },
  { id: "chatgpt-plus", name: "ChatGPT Plus", provider: "openai", monthlyUsd: 20 },
  { id: "chatgpt-pro", name: "ChatGPT Pro", provider: "openai", monthlyUsd: 200 },
];

export function getSubscriptionPlan(planId: string) {
  return subscriptionPlans.find((plan) => plan.id === planId) ?? null;
}

export function calculateSubscriptionSpend(
  planId: string,
  months: number,
  period: ReportingPeriod = defaultReportingPeriod,
) {
  const plan = getSubscriptionPlan(planId);
  if (
    !plan
    || !Number.isInteger(months)
    || months < 1
    || months > getSubscriptionMonthLimit(period)
  ) return null;

  return {
    plan,
    months,
    amountUsd: plan.monthlyUsd * months,
  };
}
