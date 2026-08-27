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
  "cursor-pro",
  "cursor-pro-plus",
  "cursor-ultra",
  "openrouter-payg",
] as const;

export type SubscriptionPlanId = (typeof subscriptionPlanIds)[number];
export type SubscriptionProvider = "anthropic" | "openai" | "cursor" | "openrouter";

type MonthlySubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  provider: SubscriptionProvider;
  billingModel: "monthly";
  monthlyUsd: number;
};

type UsageSpendPlan = {
  id: SubscriptionPlanId;
  name: string;
  provider: SubscriptionProvider;
  billingModel: "usage";
};

export type SubscriptionPlan = MonthlySubscriptionPlan | UsageSpendPlan;

export const subscriptionPlans: readonly SubscriptionPlan[] = [
  { id: "claude-pro", name: "Claude Pro", provider: "anthropic", billingModel: "monthly", monthlyUsd: 20 },
  { id: "claude-max-5x", name: "Claude Max 5×", provider: "anthropic", billingModel: "monthly", monthlyUsd: 100 },
  { id: "claude-max-20x", name: "Claude Max 20×", provider: "anthropic", billingModel: "monthly", monthlyUsd: 200 },
  { id: "chatgpt-plus", name: "ChatGPT Plus", provider: "openai", billingModel: "monthly", monthlyUsd: 20 },
  { id: "chatgpt-pro", name: "ChatGPT Pro", provider: "openai", billingModel: "monthly", monthlyUsd: 200 },
  { id: "cursor-pro", name: "Cursor Pro", provider: "cursor", billingModel: "monthly", monthlyUsd: 20 },
  { id: "cursor-pro-plus", name: "Cursor Pro+", provider: "cursor", billingModel: "monthly", monthlyUsd: 60 },
  { id: "cursor-ultra", name: "Cursor Ultra", provider: "cursor", billingModel: "monthly", monthlyUsd: 200 },
  { id: "openrouter-payg", name: "OpenRouter Pay-as-you-go", provider: "openrouter", billingModel: "usage" },
];

export function getSubscriptionPlan(planId: string) {
  return subscriptionPlans.find((plan) => plan.id === planId) ?? null;
}

export function calculateReportedAiSpend(
  planId: string,
  input: { months?: number; amountUsd?: number },
  period: ReportingPeriod = defaultReportingPeriod,
) {
  const plan = getSubscriptionPlan(planId);
  if (!plan) return null;

  if (plan.billingModel === "usage") {
    const amountUsd = input.amountUsd;
    if (
      typeof amountUsd !== "number"
      || !Number.isFinite(amountUsd)
      || amountUsd < 0.01
      || amountUsd > 10_000_000
    ) return null;

    return {
      plan,
      months: null,
      amountUsd: Math.round(amountUsd * 100) / 100,
    };
  }

  const months = input.months;
  if (
    !Number.isInteger(months)
    || (months ?? 0) < 1
    || (months ?? 0) > getSubscriptionMonthLimit(period)
  ) return null;

  return {
    plan,
    months: months as number,
    amountUsd: plan.monthlyUsd * (months as number),
  };
}
