import { z } from "zod";

import { ApiError, apiErrorResponse, assertSameOrigin, requireSubmissionConfiguration } from "@/lib/api";
import {
  defaultReportingPeriod,
  getSubscriptionMonthLimit,
  reportingPeriodIds,
} from "@/lib/reporting-period";
import { calculateReportedAiSpend, subscriptionPlanIds } from "@/lib/subscription-plans";
import { getVerificationWindow, issueVerificationReceipt } from "@/lib/verification";

const schema = z.object({
  planId: z.enum(subscriptionPlanIds),
  months: z.number().int().min(1).max(getSubscriptionMonthLimit("all")).optional(),
  amountUsd: z.number().finite().min(0.01).max(10_000_000).optional(),
  submissionId: z.string().uuid(),
  period: z.enum(reportingPeriodIds).default(defaultReportingPeriod),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireSubmissionConfiguration();
    const { planId, months, amountUsd, submissionId, period } = schema.parse(await request.json());
    const selection = calculateReportedAiSpend(planId, { months, amountUsd }, period);
    if (!selection) {
      throw new ApiError("Choose a valid membership period or enter the exact provider spend for this reporting window.", 400);
    }
    const { periodStart, periodEnd } = getVerificationWindow(period);
    const result = issueVerificationReceipt({
      kind: "tokens",
      userId: submissionId,
      provider: selection.plan.provider,
      verificationMethod: "self_reported",
      amountUsd: selection.amountUsd,
      periodStart,
      periodEnd,
    });

    return Response.json({
      receipt: result.receipt,
      amountUsd: result.payload.amountUsd,
      periodStart,
      periodEnd,
      period,
      verificationMethod: result.payload.verificationMethod,
      subscription: {
        planId: selection.plan.id,
        name: selection.plan.name,
        billingModel: selection.plan.billingModel,
        monthlyUsd: selection.plan.billingModel === "monthly" ? selection.plan.monthlyUsd : null,
        months: selection.months,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
