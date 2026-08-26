import { z } from "zod";

import { ApiError, apiErrorResponse, assertSameOrigin, requireSubmissionConfiguration } from "@/lib/api";
import {
  defaultReportingPeriod,
  getSubscriptionMonthLimit,
  reportingPeriodIds,
} from "@/lib/reporting-period";
import { calculateSubscriptionSpend, subscriptionPlanIds } from "@/lib/subscription-plans";
import { getVerificationWindow, issueVerificationReceipt } from "@/lib/verification";

const schema = z.object({
  planId: z.enum(subscriptionPlanIds),
  months: z.number().int().min(1).max(getSubscriptionMonthLimit("all")),
  submissionId: z.string().uuid(),
  period: z.enum(reportingPeriodIds).default(defaultReportingPeriod),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireSubmissionConfiguration();
    const { planId, months, submissionId, period } = schema.parse(await request.json());
    const selection = calculateSubscriptionSpend(planId, months, period);
    if (!selection) {
      throw new ApiError("Choose a valid number of paid months for this reporting window.", 400);
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
        monthlyUsd: selection.plan.monthlyUsd,
        months: selection.months,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
