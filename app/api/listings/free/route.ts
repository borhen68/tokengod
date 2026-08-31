import { z } from "zod";
import type { NextRequest } from "next/server";

import { ApiError, apiErrorResponse, assertSameOrigin, requireSubmissionConfiguration } from "@/lib/api";
import { ANONYMOUS_FOUNDER_NAME, anonymousFounderHandle } from "@/lib/anonymous-founder";
import { getDatabase } from "@/lib/db";
import { materializeEntry, type MaterializedEntry } from "@/lib/entry-materializer";
import { projectOutcomeIds } from "@/lib/project-outcomes";
import { verifyVerificationReceipt } from "@/lib/verification";
import { lookupPublicXProfile } from "@/lib/x-profile";
import type { ModelProvider } from "@/lib/types";

function toModelProvider(provider: string): ModelProvider {
  return provider === "openai" || provider === "anthropic" ? provider : "other";
}

const publicUrlSchema = z.string().trim().url().refine(
  (value) => ["http:", "https:"].includes(new URL(value).protocol),
  { message: "Product URL must start with http:// or https://." },
);

const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  url: publicUrlSchema,
  description: z.string().trim().min(12).max(320),
  logoUrl: z.string().trim().url().refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    { message: "Product logo URL must start with http:// or https://." },
  ).nullable().optional(),
});

const freeEntrySchema = z.object({
  submissionId: z.string().uuid(),
  anonymous: z.boolean().optional().default(false),
  xHandle: z.string().trim().max(16).optional().default("").transform((value) => value.replace(/^@/, "")),
  products: z.array(productSchema).min(1).max(20),
  tokenReceipt: z.string().min(40),
  revenueReceipt: z.string().min(40),
  projectOutcome: z.enum(projectOutcomeIds).default("revenue"),
  founderLesson: z.string().trim().max(180).optional().default(""),
}).superRefine((value, context) => {
  if (!value.anonymous && !/^[A-Za-z0-9_]{1,15}$/.test(value.xHandle)) {
    context.addIssue({ code: "custom", path: ["xHandle"], message: "Enter a valid X handle using letters, numbers, or underscores." });
  }
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireSubmissionConfiguration();
    const input = freeEntrySchema.parse(await request.json());
    const tokens = verifyVerificationReceipt(input.tokenReceipt, { userId: input.submissionId, kind: "tokens" });
    const revenue = verifyVerificationReceipt(input.revenueReceipt, { userId: input.submissionId, kind: "revenue" });

    if (tokens.periodStart !== revenue.periodStart || tokens.periodEnd !== revenue.periodEnd) {
      throw new ApiError("The verification windows do not match. Reconnect both accounts.", 400);
    }
    if (tokens.amountUsd <= 0) throw new ApiError("AI spend must be greater than zero for the selected reporting window.", 400);
    if (input.projectOutcome === "revenue" && revenue.amountUsd === 0) throw new ApiError("Verified revenue is $0. Choose Pre-revenue or Shut down.", 400);
    if (input.projectOutcome === "pre_revenue" && revenue.amountUsd > 0) throw new ApiError("Verified revenue is above $0. Choose Made revenue or Shut down.", 400);

    const products = input.products.map((product) => ({ ...product, url: new URL(product.url).toString(), logoUrl: product.logoUrl || null }));
    const uniqueUrls = new Set(products.map((product) => product.url.toLowerCase()));
    if (uniqueUrls.size !== products.length) throw new ApiError("Each site can only be added once.", 400);

    const storedXHandle = input.anonymous ? anonymousFounderHandle(input.submissionId) : input.xHandle;
    const founderProfile = input.anonymous ? null : await lookupPublicXProfile(input.xHandle);
    const preparedEntry: MaterializedEntry = {
      submissionId: input.submissionId,
      xHandle: storedXHandle,
      founderName: input.anonymous ? ANONYMOUS_FOUNDER_NAME : founderProfile?.name || `@${input.xHandle}`,
      founderAvatarUrl: input.anonymous ? null : founderProfile?.avatarUrl || null,
      products,
      tokensSpentUsd: tokens.amountUsd,
      revenueUsd: revenue.amountUsd,
      efficiencyScore: Math.round((revenue.amountUsd / tokens.amountUsd) * 10_000) / 10_000,
      projectOutcome: input.projectOutcome,
      founderLesson: input.founderLesson,
      modelProvider: toModelProvider(tokens.provider),
      aiSpendVerification: tokens.verificationMethod,
      revenueProvider: revenue.provider,
      verificationPeriodStart: new Date(tokens.periodStart).getTime(),
      verificationPeriodEnd: new Date(tokens.periodEnd).getTime(),
      tokenNonce: tokens.nonce,
      revenueNonce: revenue.nonce,
    };

    const db = getDatabase();
    const existing = await db.execute({ sql: "select id from listings where owner_user_id = ? limit 1", args: [input.submissionId] });
    if (existing.rows[0]?.id) return Response.json({ listingId: String(existing.rows[0].id) });

    const tx = await db.transaction("write");
    try {
      const listingId = await materializeEntry(tx, preparedEntry, {
        legacyBidCents: 300,
        fundedCents: 0,
        checkoutSessionId: null,
        entrySource: "seed",
      });
      await tx.commit();
      return Response.json({ listingId, entryKind: "free" });
    } catch (error) {
      if (!tx.closed) await tx.rollback();
      throw error;
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
