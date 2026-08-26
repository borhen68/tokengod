import { z } from "zod";

import { apiErrorResponse, assertSameOrigin, requireSubmissionConfiguration } from "@/lib/api";
import { ProviderVerificationError } from "@/lib/providers/errors";
import { verifyRevenue } from "@/lib/providers/revenue";
import { defaultReportingPeriod, reportingPeriodIds } from "@/lib/reporting-period";
import { revenueProviderIds } from "@/lib/revenue-providers";
import {
  getVerificationWindow,
  issueVerificationReceipt,
} from "@/lib/verification";

const schema = z.object({
  apiKey: z.string().min(8).max(500),
  provider: z.enum(revenueProviderIds),
  submissionId: z.string().uuid(),
  period: z.enum(reportingPeriodIds).default(defaultReportingPeriod),
});

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireSubmissionConfiguration();
    const { apiKey, provider, submissionId, period } = schema.parse(await request.json());
    const { periodStart, periodEnd } = getVerificationWindow(period);
    const amountUsd = await verifyRevenue(
      provider,
      apiKey.trim(),
      periodStart,
      periodEnd,
    );
    const result = issueVerificationReceipt({
      kind: "revenue",
      userId: submissionId,
      provider,
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
      period,
      provider,
      verificationMethod: result.payload.verificationMethod,
    });
  } catch (error) {
    if (error instanceof ProviderVerificationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return apiErrorResponse(error);
  }
}
