import "server-only";

import { randomUUID } from "node:crypto";
import type { Transaction } from "@libsql/client";

import { ApiError } from "@/lib/api";
import type { ProjectOutcome } from "@/lib/project-outcomes";
import type { AiSpendVerification, ModelProvider } from "@/lib/types";

export type MaterializedProduct = {
  name: string;
  url: string;
  description: string;
  logoUrl: string | null;
};

export type MaterializedEntry = {
  submissionId: string;
  xHandle: string;
  founderName: string;
  founderAvatarUrl: string | null;
  products: MaterializedProduct[];
  tokensSpentUsd: number;
  revenueUsd: number;
  efficiencyScore: number;
  projectOutcome: ProjectOutcome;
  founderLesson: string;
  modelProvider: ModelProvider;
  aiSpendVerification: AiSpendVerification;
  revenueProvider: string;
  verificationPeriodStart: number;
  verificationPeriodEnd: number;
  tokenNonce: string;
  revenueNonce: string;
};

export async function materializeEntry(
  tx: Transaction,
  entry: MaterializedEntry,
  payment: {
    legacyBidCents: number;
    fundedCents: number;
    checkoutSessionId: string | null;
    entrySource: "paid" | "launch_free" | "seed";
  },
) {
  const used = await tx.execute({
    sql: "select nonce from verification_claims where nonce in (?, ?) limit 1",
    args: [entry.tokenNonce, entry.revenueNonce],
  });
  if (used.rows.length) {
    throw new ApiError("These verification receipts were already claimed.", 409);
  }

  const now = Date.now();
  await tx.execute({
    sql: `insert into users (
          id, x_handle, x_user_id, display_name, avatar_url, created_at, updated_at
          ) values (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.submissionId,
      entry.xHandle,
      `submitted:${entry.submissionId}`,
      entry.founderName,
      entry.founderAvatarUrl,
      now,
      now,
    ],
  });
  await tx.execute({
    sql: "insert into verification_claims (nonce, user_id, kind, used_at) values (?, ?, 'tokens', ?), (?, ?, 'revenue', ?)",
    args: [
      entry.tokenNonce,
      entry.submissionId,
      now,
      entry.revenueNonce,
      entry.submissionId,
      now,
    ],
  });

  const primaryProduct = entry.products[0];
  if (!primaryProduct) throw new ApiError("Add at least one product.", 400);
  const listingId = randomUUID();
  await tx.execute({
    sql: `insert into listings (
            id, owner_user_id, product_name, product_url, product_description,
            product_logo_url, products_json,
            tokens_spent_usd, revenue_usd, efficiency_score, model_provider,
            project_outcome, founder_lesson,
            ai_spend_verification, revenue_provider,
            verification_period_start, verification_period_end, verified_at,
            created_at, updated_at, bid_cents, funded_cents, entry_source,
            stripe_checkout_session_id
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      listingId,
      entry.submissionId,
      primaryProduct.name,
      primaryProduct.url,
      primaryProduct.description,
      primaryProduct.logoUrl,
      JSON.stringify(entry.products),
      entry.tokensSpentUsd,
      entry.revenueUsd,
      entry.efficiencyScore,
      entry.modelProvider,
      entry.projectOutcome,
      entry.founderLesson,
      entry.aiSpendVerification,
      entry.revenueProvider,
      entry.verificationPeriodStart,
      entry.verificationPeriodEnd,
      now,
      now,
      now,
      payment.legacyBidCents,
      payment.fundedCents,
      payment.entrySource,
      payment.checkoutSessionId,
    ],
  });

  return listingId;
}
