import { z } from "zod";

import { apiErrorResponse, assertSameOrigin, requireSubmissionConfiguration } from "@/lib/api";
import { getVerificationWindow, issueVerificationReceipt } from "@/lib/verification";

const schema = z.object({
  amountUsd: z.number().positive().finite().max(1_000_000),
  provider: z.enum(["anthropic", "openai"]),
  submissionId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireSubmissionConfiguration();
    const { amountUsd, provider, submissionId } = schema.parse(await request.json());
    const { periodStart, periodEnd } = getVerificationWindow();
    const result = issueVerificationReceipt({
      kind: "tokens",
      userId: submissionId,
      provider,
      verificationMethod: "self_reported",
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
    return apiErrorResponse(error);
  }
}
