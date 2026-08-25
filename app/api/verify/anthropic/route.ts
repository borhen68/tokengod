import { z } from "zod";

import { apiErrorResponse, assertSameOrigin, requireSubmissionConfiguration } from "@/lib/api";
import { verifyAnthropicCost } from "@/lib/providers/anthropic";
import { ProviderVerificationError } from "@/lib/providers/errors";
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
    const amountUsd = await verifyAnthropicCost(
      apiKey.trim(),
      periodStart,
      periodEnd,
    );
    const result = issueVerificationReceipt({
      kind: "tokens",
      userId: submissionId,
      provider: "anthropic",
      verificationMethod: "api",
      amountUsd,
      periodStart,
      periodEnd,
    });

    return Response.json({
      receipt: result.receipt,
      amountUsd: result.payload.amountUsd,
      periodStart,
      periodEnd,
      verificationMethod: result.payload.verificationMethod,
    });
  } catch (error) {
    if (error instanceof ProviderVerificationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return apiErrorResponse(error);
  }
}
