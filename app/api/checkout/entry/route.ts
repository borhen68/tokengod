import { z } from "zod";
import type Stripe from "stripe";
import type { NextRequest } from "next/server";

import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  requirePaymentConfiguration,
  requireSubmissionConfiguration,
} from "@/lib/api";
import {
  ANONYMOUS_FOUNDER_NAME,
  anonymousFounderHandle,
} from "@/lib/anonymous-founder";
import { getDatabase } from "@/lib/db";
import { getDataFastStripeMetadata } from "@/lib/datafast-server";
import type { MaterializedEntry } from "@/lib/entry-materializer";
import { finalizeLaunchEntry } from "@/lib/launch-entry";
import { getPlatformStripe } from "@/lib/platform-stripe";
import { projectOutcomeIds } from "@/lib/project-outcomes";
import { verifyVerificationReceipt } from "@/lib/verification";
import { lookupPublicXProfile } from "@/lib/x-profile";

const publicUrlSchema = z.string().trim().url().refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    { message: "Product URL must start with http:// or https://." },
  );

const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  url: publicUrlSchema,
  description: z.string().trim().max(320),
  logoUrl: z.string().trim().url().refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    { message: "Product logo URL must start with http:// or https://." },
  ).nullable().optional(),
});

const entrySchema = z.object({
  submissionId: z.string().uuid(),
  anonymous: z.boolean().optional().default(false),
  xHandle: z.string().trim().max(16).optional().default("").transform((value) => value.replace(/^@/, "")),
  products: z.array(productSchema).min(1).max(20),
  tokenReceipt: z.string().min(40),
  revenueReceipt: z.string().min(40),
  projectOutcome: z.enum(projectOutcomeIds).default("revenue"),
  founderLesson: z.string().trim().max(180).optional().default(""),
  bidCents: z.number().int().min(300).max(100_000).multipleOf(100),
  claimLaunchFree: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  if (!value.anonymous && !/^[A-Za-z0-9_]{1,15}$/.test(value.xHandle)) {
    context.addIssue({
      code: "custom",
      path: ["xHandle"],
      message: "Enter a valid X handle using letters, numbers, or underscores.",
    });
  }
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireSubmissionConfiguration();
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
      throw new ApiError("AI spend must be greater than zero for the selected reporting window.", 400);
    }
    if (input.projectOutcome === "revenue" && revenue.amountUsd === 0) {
      throw new ApiError("Verified revenue is $0. Choose Pre-revenue or Shut down.", 400);
    }
    if (input.projectOutcome === "pre_revenue" && revenue.amountUsd > 0) {
      throw new ApiError("Verified revenue is above $0. Choose Made revenue or Shut down.", 400);
    }

    const products = input.products.map((product) => ({
      ...product,
      url: new URL(product.url).toString(),
      logoUrl: product.logoUrl || null,
    }));
    if (products[0].description.length < 12) {
      throw new ApiError("The primary site needs a description of at least 12 characters.", 400);
    }
    const uniqueUrls = new Set(products.map((product) => product.url.toLowerCase()));
    if (uniqueUrls.size !== products.length) {
      throw new ApiError("Each site can only be added once.", 400);
    }

    const primaryProduct = products[0];
    const extraSiteCount = Math.max(0, products.length - 3);
    const siteFeeCents = extraSiteCount * 100;
    const checkoutTotalCents = input.bidCents + siteFeeCents;
    const storedXHandle = input.anonymous
      ? anonymousFounderHandle(input.submissionId)
      : input.xHandle;

    const db = getDatabase();
    const existing = await db.execute({
      sql: "select stripe_checkout_session_id, status, listing_id, x_handle from pending_submissions where id = ? limit 1",
      args: [input.submissionId],
    });
    if (existing.rows[0]?.status === "completed" && existing.rows[0].listing_id) {
      return Response.json({ listingId: String(existing.rows[0].listing_id) });
    }
    if (existing.rows[0]?.stripe_checkout_session_id) {
      if (String(existing.rows[0].x_handle) !== storedXHandle) {
        throw new ApiError("This checkout was created with a different identity choice. Refresh and verify again.", 409);
      }
      if (input.claimLaunchFree) {
        throw new ApiError("This verification already started a paid checkout. Refresh and verify again to claim a launch pass.", 409);
      }
      requirePaymentConfiguration();
      const checkout = await getPlatformStripe().checkout.sessions.retrieve(
        String(existing.rows[0].stripe_checkout_session_id),
      );
      if (!checkout.url) throw new ApiError("That checkout session has expired. Refresh and try again.", 409);
      return Response.json({ url: checkout.url });
    }

    const founderProfile = input.anonymous
      ? null
      : await lookupPublicXProfile(input.xHandle);
    const preparedEntry: MaterializedEntry = {
      submissionId: input.submissionId,
      xHandle: storedXHandle,
      founderName: input.anonymous
        ? ANONYMOUS_FOUNDER_NAME
        : founderProfile?.name || `@${input.xHandle}`,
      founderAvatarUrl: input.anonymous ? null : founderProfile?.avatarUrl || null,
      products,
      tokensSpentUsd: tokens.amountUsd,
      revenueUsd: revenue.amountUsd,
      efficiencyScore: Math.round((revenue.amountUsd / tokens.amountUsd) * 10_000) / 10_000,
      projectOutcome: input.projectOutcome,
      founderLesson: input.founderLesson,
      modelProvider: tokens.provider === "openai" ? "openai" : "anthropic",
      aiSpendVerification: tokens.verificationMethod,
      revenueProvider: revenue.provider,
      verificationPeriodStart: new Date(tokens.periodStart).getTime(),
      verificationPeriodEnd: new Date(tokens.periodEnd).getTime(),
      tokenNonce: tokens.nonce,
      revenueNonce: revenue.nonce,
    };

    if (input.claimLaunchFree) {
      if (input.bidCents !== 300 || products.length > 3) {
        throw new ApiError("Launch passes cover the base profile and up to three products. Remove paid extras to publish free.", 400);
      }
      const listingId = await finalizeLaunchEntry(preparedEntry, {
        anonymous: input.anonymous,
      });
      if (!listingId) {
        throw new ApiError("The final free launch pass was just claimed. Refresh to continue with the $3 entry.", 409);
      }
      return Response.json({ listingId, entryKind: "launch_free" });
    }

    requirePaymentConfiguration();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const dataFastMetadata = getDataFastStripeMetadata(request);
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: input.bidCents,
        product_data: {
          name: `TokenGod entry — ${primaryProduct.name}`,
          description: input.bidCents === 300
            ? `Leaderboard entry · ${Math.min(products.length, 3)} product${products.length === 1 ? "" : "s"} included`
            : `Leaderboard entry + $${((input.bidCents - 300) / 100).toFixed(0)} Top Funded bid`,
        },
      },
    }];
    if (extraSiteCount > 0) {
      lineItems.push({
        quantity: extraSiteCount,
        price_data: {
          currency: "usd",
          unit_amount: 100,
          product_data: {
            name: "Additional TokenGod site",
            description: "Site 4+ · does not affect Top Funded rank",
          },
        },
      });
    }
    const checkout = await getPlatformStripe().checkout.sessions.create({
      mode: "payment",
      client_reference_id: input.submissionId,
      payment_method_types: ["card"],
      line_items: lineItems,
      metadata: {
        app: "tokengod",
        kind: "entry",
        pending_submission_id: input.submissionId,
        site_count: String(products.length),
        site_fee_cents: String(siteFeeCents),
        ai_spend_verification: tokens.verificationMethod,
        revenue_provider: revenue.provider,
        identity_visibility: input.anonymous ? "anonymous" : "public",
        project_outcome: input.projectOutcome,
        ...dataFastMetadata,
      },
      payment_intent_data: {
        metadata: {
          app: "tokengod",
          kind: "entry",
          pending_submission_id: input.submissionId,
          site_count: String(products.length),
          site_fee_cents: String(siteFeeCents),
          ai_spend_verification: tokens.verificationMethod,
          revenue_provider: revenue.provider,
          identity_visibility: input.anonymous ? "anonymous" : "public",
          project_outcome: input.projectOutcome,
          ...dataFastMetadata,
        },
      },
      success_url: `${siteUrl}/payment/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?enter=1&bid=${input.bidCents}&payment=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    }, {
      idempotencyKey: `tokengod-entry-${input.submissionId}`,
    });
    if (!checkout.url) throw new ApiError("Stripe did not return a checkout URL.", 502);
    if (checkout.amount_total !== checkoutTotalCents) {
      throw new ApiError("Stripe returned an unexpected checkout total.", 502);
    }

    const now = Date.now();
    await db.execute({
      sql: `insert into pending_submissions (
              id, x_handle, founder_name, founder_avatar_url,
              product_name, product_url, product_description,
              product_logo_url, products_json,
              tokens_spent_usd, revenue_usd, efficiency_score, model_provider,
              project_outcome, founder_lesson,
              ai_spend_verification, revenue_provider,
              verification_period_start, verification_period_end, token_nonce,
              revenue_nonce, bid_cents, site_fee_cents, stripe_checkout_session_id, status,
              listing_id, created_at, expires_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', null, ?, ?)`,
      args: [
        input.submissionId,
        storedXHandle,
        input.anonymous
          ? ANONYMOUS_FOUNDER_NAME
          : founderProfile?.name || `@${input.xHandle}`,
        input.anonymous ? null : founderProfile?.avatarUrl || null,
        primaryProduct.name,
        primaryProduct.url,
        primaryProduct.description,
        primaryProduct.logoUrl,
        JSON.stringify(products),
        tokens.amountUsd,
        revenue.amountUsd,
        Math.round((revenue.amountUsd / tokens.amountUsd) * 10_000) / 10_000,
        tokens.provider,
        input.projectOutcome,
        input.founderLesson,
        tokens.verificationMethod,
        revenue.provider,
        new Date(tokens.periodStart).getTime(),
        new Date(tokens.periodEnd).getTime(),
        tokens.nonce,
        revenue.nonce,
        input.bidCents,
        siteFeeCents,
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
