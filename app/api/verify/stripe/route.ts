import { z } from "zod";

import { apiErrorResponse, assertSameOrigin, requireSubmissionConfiguration } from "@/lib/api";
import { ProviderVerificationError } from "@/lib/providers/errors";
import { verifyStripeRevenue } from "@/lib/providers/stripe";
import {
  getVerificationWindow,
  issueVerificationReceipt,
} from "@/lib/verification";

const schema = z.object({
  apiKey: z.string().min(20).max(300),
  submissionId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireSubmissionConfiguration();
    const { apiKey, submissionId } = schema.parse(await request.json());
    const { periodStart, periodEnd } = getVerificationWindow();
    const amountUsd = await verifyStripeRevenue(
      apiKey.trim(),
      periodStart,
      periodEnd,
    );
    const result = issueVerificationReceipt({
      kind: "revenue",
      userId: submissionId,
      provider: "stripe",
      amountUsd,
      periodStart,
      periodEnd,
    });

    return Response.json({
      receipt: result.receipt,
      amountUsd: result.payload.amountUsd,
      periodStart,
      periodEnd,
    });
  } catch (error) {
    if (error instanceof ProviderVerificationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return apiErrorResponse(error);
  }
}
