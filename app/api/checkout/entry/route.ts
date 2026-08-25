import { z } from "zod";

import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  requirePaymentConfiguration,
  requireSubmissionConfiguration,
} from "@/lib/api";
import { getDatabase } from "@/lib/db";
import { getPlatformStripe } from "@/lib/platform-stripe";
import { verifyVerificationReceipt } from "@/lib/verification";
import { lookupPublicXProfile } from "@/lib/x-profile";

const entrySchema = z.object({
  submissionId: z.string().uuid(),
  xHandle: z.string().trim().max(16).transform((value) => value.replace(/^@/, "")).refine(
    (value) => /^[A-Za-z0-9_]{1,15}$/.test(value),
    { message: "Enter a valid X handle using letters, numbers, or underscores." },
  ),
  productName: z.string().trim().min(2).max(80),
  productUrl: z.string().trim().url().refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    { message: "Product URL must start with http:// or https://." },
  ),
  productDescription: z.string().trim().min(12).max(320),
  productLogoUrl: z.string().trim().url().refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    { message: "Product logo URL must start with http:// or https://." },
  ).nullable().optional(),
  tokenReceipt: z.string().min(40),
  revenueReceipt: z.string().min(40),
  bidCents: z.number().int().min(300).max(100_000).multipleOf(100),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireSubmissionConfiguration();
    requirePaymentConfiguration();
    const input = entrySchema.parse(await request.json());
    const tokens = verifyVerificationReceipt(input.tokenReceipt, {
      userId: input.submissionId,
      kind: "tokens",
    });
    const revenue = verifyVerificationReceipt(input.revenueReceipt, {
      userId: input.submissionId,
      kind: "revenue",
    });

    if (tokens.periodStart !== revenue.periodStart || tokens.periodEnd !== revenue.periodEnd) {
      throw new ApiError("The verification windows do not match. Reconnect both accounts.", 400);
    }
    if (tokens.amountUsd <= 0) {
      throw new ApiError("No AI spend was found in the verified 90-day window.", 400);
    }

    const db = getDatabase();
    const existing = await db.execute({
      sql: "select stripe_checkout_session_id, status, listing_id from pending_submissions where id = ? limit 1",
      args: [input.submissionId],
    });
    if (existing.rows[0]?.status === "completed" && existing.rows[0].listing_id) {
      return Response.json({ listingId: String(existing.rows[0].listing_id) });
    }
    if (existing.rows[0]?.stripe_checkout_session_id) {
      const checkout = await getPlatformStripe().checkout.sessions.retrieve(
        String(existing.rows[0].stripe_checkout_session_id),
      );
      if (!checkout.url) throw new ApiError("That checkout session has expired. Refresh and try again.", 409);
      return Response.json({ url: checkout.url });
    }

    const founderProfile = await lookupPublicXProfile(input.xHandle);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const checkout = await getPlatformStripe().checkout.sessions.create({
      mode: "payment",
      client_reference_id: input.submissionId,
      payment_method_types: ["card"],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.bidCents,
          product_data: {
            name: `TokenGod entry — ${input.productName}`,
            description: input.bidCents === 300
              ? "Verified leaderboard entry"
              : `Verified entry + $${((input.bidCents - 300) / 100).toFixed(0)} Surface boost`,
          },
        },
      }],
      metadata: {
        app: "tokengod",
        kind: "entry",
        pending_submission_id: input.submissionId,
      },
      payment_intent_data: {
        metadata: {
          app: "tokengod",
          kind: "entry",
          pending_submission_id: input.submissionId,
        },
      },
      success_url: `${siteUrl}/payment/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?enter=1&bid=${input.bidCents}&payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    }, {
      idempotencyKey: `tokengod-entry-${input.submissionId}`,
    });
    if (!checkout.url) throw new ApiError("Stripe did not return a checkout URL.", 502);

    const now = Date.now();
    await db.execute({
      sql: `insert into pending_submissions (
              id, x_handle, founder_name, founder_avatar_url,
              product_name, product_url, product_description,
              product_logo_url,
              tokens_spent_usd, revenue_usd, efficiency_score, model_provider,
              verification_period_start, verification_period_end, token_nonce,
              revenue_nonce, bid_cents, stripe_checkout_session_id, status,
              listing_id, created_at, expires_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', null, ?, ?)`,
      args: [
        input.submissionId,
        input.xHandle,
        founderProfile?.name || `@${input.xHandle}`,
        founderProfile?.avatarUrl || null,
        input.productName,
        input.productUrl,
        input.productDescription,
        input.productLogoUrl || null,
        tokens.amountUsd,
        revenue.amountUsd,
        Math.round((revenue.amountUsd / tokens.amountUsd) * 10_000) / 10_000,
        tokens.provider,
        new Date(tokens.periodStart).getTime(),
        new Date(tokens.periodEnd).getTime(),
        tokens.nonce,
        revenue.nonce,
        input.bidCents,
        checkout.id,
        now,
        now + 30 * 60 * 1000,
      ],
    });

    return Response.json({ url: checkout.url });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
