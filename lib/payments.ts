import "server-only";

import { randomUUID } from "node:crypto";
import type Stripe from "stripe";

import { ApiError } from "@/lib/api";
import { getDatabase } from "@/lib/db";
import { materializeEntry } from "@/lib/entry-materializer";
import type { ModelProvider } from "@/lib/types";

type PaymentResult = {
  kind: "entry" | "boost" | "wall_entry";
  listingId: string;
};

function requirePaidUsd(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    throw new ApiError("Payment has not completed yet.", 409);
  }
  if (session.currency?.toLowerCase() !== "usd" || !session.amount_total) {
    throw new ApiError("Payment amount could not be verified.", 400);
  }
}

function toModelProvider(provider: unknown): ModelProvider {
  const value = String(provider || "");
  if (value === "openai" || value === "anthropic") {
    return value;
  }
  return "other";
}

export async function finalizeCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<PaymentResult> {
  requirePaidUsd(session);
  if (session.metadata?.app !== "tokengod") {
    throw new ApiError("Unknown TokenGod payment.", 400);
  }
  const kind = session.metadata?.kind;
  if (kind !== "entry" && kind !== "boost" && kind !== "wall_entry") {
    throw new ApiError("Unknown TokenGod payment.", 400);
  }

  const db = getDatabase();
  const tx = await db.transaction("write");
  const now = Date.now();

  try {
    if (kind === "wall_entry") {
      const pendingId = session.metadata?.pending_wall_product_id;
      if (!pendingId) throw new ApiError("Missing wall payment metadata.", 400);
      const result = await tx.execute({ sql: "select * from pending_wall_products where id = ? limit 1", args: [pendingId] });
      const pending = result.rows[0];
      if (!pending) throw new ApiError("That bubble checkout could not be found.", 404);
      if (String(pending.status) === "completed" && pending.wall_product_id) {
        await tx.rollback();
        return { kind, listingId: String(pending.wall_product_id) };
      }
      if (String(pending.stripe_checkout_session_id) !== session.id || Number(pending.paid_cents) !== session.amount_total) {
        throw new ApiError("Checkout does not match this bubble.", 400);
      }
      const wallProductId = randomUUID();
      await tx.execute({
        sql: `insert into wall_products
          (id, product_name, product_url, product_description, product_logo_url, builder_label, visit_count, paid_cents, stripe_checkout_session_id, created_at, updated_at)
          values (?, ?, ?, ?, ?, 'independent builder', 0, ?, ?, ?, ?)`,
        args: [wallProductId, String(pending.product_name), String(pending.product_url), String(pending.product_description || ""), pending.product_logo_url ? String(pending.product_logo_url) : null, Number(pending.paid_cents), session.id, now, now],
      });
      await tx.execute({ sql: "update pending_wall_products set status = 'completed', wall_product_id = ? where id = ?", args: [wallProductId, pendingId] });
      await tx.commit();
      return { kind, listingId: wallProductId };
    }

    if (kind === "entry") {
      const pendingId = session.metadata?.pending_submission_id;
      if (!pendingId) throw new ApiError("Missing submission payment metadata.", 400);

      const result = await tx.execute({
        sql: "select * from pending_submissions where id = ? limit 1",
        args: [pendingId],
      });
      const pending = result.rows[0];
      if (!pending) throw new ApiError("That paid submission could not be found.", 404);
      if (String(pending.status) === "completed" && pending.listing_id) {
        await tx.rollback();
        return { kind, listingId: String(pending.listing_id) };
      }
      if (String(pending.stripe_checkout_session_id) !== session.id) {
        throw new ApiError("Checkout session does not match this submission.", 400);
      }
      const siteFeeCents = Number(pending.site_fee_cents || 0);
      if (Number(pending.bid_cents) + siteFeeCents !== session.amount_total) {
        throw new ApiError("Checkout amount does not match this submission.", 400);
      }

      const storedProducts = pending.products_json
        ? JSON.parse(String(pending.products_json)) as Array<{
          name: string;
          url: string;
          description: string;
          logoUrl?: string | null;
        }>
        : [{
          name: String(pending.product_name),
          url: String(pending.product_url),
          description: String(pending.product_description),
          logoUrl: pending.product_logo_url ? String(pending.product_logo_url) : null,
        }];
      const listingId = await materializeEntry(tx, {
        submissionId: pendingId,
        xHandle: String(pending.x_handle),
        founderName: pending.founder_name
          ? String(pending.founder_name)
          : `@${String(pending.x_handle)}`,
        founderAvatarUrl: pending.founder_avatar_url
          ? String(pending.founder_avatar_url)
          : null,
        products: storedProducts.map((product) => ({
          name: product.name,
          url: product.url,
          description: product.description,
          logoUrl: product.logoUrl || null,
        })),
        tokensSpentUsd: Number(pending.tokens_spent_usd),
        revenueUsd: Number(pending.revenue_usd),
        efficiencyScore: Number(pending.efficiency_score),
        projectOutcome: pending.project_outcome === "pre_revenue" || pending.project_outcome === "shut_down"
          ? pending.project_outcome
          : "revenue",
        founderLesson: String(pending.founder_lesson || ""),
        modelProvider: toModelProvider(pending.model_provider),
        aiSpendVerification: pending.ai_spend_verification === "self_reported" ? "self_reported" : "api",
        revenueProvider: pending.revenue_provider ? String(pending.revenue_provider) : "stripe",
        verificationPeriodStart: Number(pending.verification_period_start),
        verificationPeriodEnd: Number(pending.verification_period_end),
        tokenNonce: String(pending.token_nonce),
        revenueNonce: String(pending.revenue_nonce),
      }, {
        legacyBidCents: Number(pending.bid_cents),
        fundedCents: Number(pending.bid_cents),
        checkoutSessionId: session.id,
        entrySource: "paid",
      });
      await tx.execute({
        sql: "update pending_submissions set status = 'completed', listing_id = ? where id = ?",
        args: [listingId, pendingId],
      });
      await tx.commit();
      return { kind, listingId };
    }

    const listingId = session.metadata?.listing_id;
    const amountCents = Number(session.metadata?.amount_cents);
    if (!listingId || !Number.isInteger(amountCents) || amountCents < 100) {
      throw new ApiError("Missing boost payment metadata.", 400);
    }
    if (amountCents !== session.amount_total) {
      throw new ApiError("Checkout amount does not match this boost.", 400);
    }

    const processed = await tx.execute({
      sql: "select listing_id from processed_boosts where stripe_checkout_session_id = ? limit 1",
      args: [session.id],
    });
    if (processed.rows[0]?.listing_id) {
      await tx.rollback();
      return { kind, listingId: String(processed.rows[0].listing_id) };
    }

    const updated = await tx.execute({
      sql: "update listings set bid_cents = bid_cents + ?, funded_cents = funded_cents + ?, updated_at = ? where id = ?",
      args: [amountCents, amountCents, now, listingId],
    });
    if (updated.rowsAffected !== 1) {
      throw new ApiError("That build is no longer in the tank.", 404);
    }
    await tx.execute({
      sql: "insert into processed_boosts (stripe_checkout_session_id, listing_id, amount_cents, completed_at) values (?, ?, ?, ?)",
      args: [session.id, listingId, amountCents, now],
    });
    await tx.commit();
    return { kind, listingId };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
