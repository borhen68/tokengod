import { z } from "zod";

import { apiErrorResponse, assertSameOrigin, requireSubmissionConfiguration } from "@/lib/api";
import { calculateSubscriptionSpend, subscriptionPlanIds } from "@/lib/subscription-plans";
import { getVerificationWindow, issueVerificationReceipt } from "@/lib/verification";

const schema = z.object({
  planId: z.enum(subscriptionPlanIds),
  months: z.number().int().min(1).max(3),
  submissionId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireSubmissionConfiguration();
    const { planId, months, submissionId } = schema.parse(await request.json());
    const selection = calculateSubscriptionSpend(planId, months);
    if (!selection) throw new Error("Invalid subscription selection.");
    const { periodStart, periodEnd } = getVerificationWindow();
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
