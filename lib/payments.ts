import "server-only";

import { randomUUID } from "node:crypto";
import type Stripe from "stripe";

import { ApiError } from "@/lib/api";
import { getDatabase } from "@/lib/db";

type PaymentResult = {
  kind: "entry" | "boost";
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

export async function finalizeCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<PaymentResult> {
  requirePaidUsd(session);
  if (session.metadata?.app !== "tokengod") {
    throw new ApiError("Unknown TokenGod payment.", 400);
  }
  const kind = session.metadata?.kind;
  if (kind !== "entry" && kind !== "boost") {
    throw new ApiError("Unknown TokenGod payment.", 400);
  }

  const db = getDatabase();
  const tx = await db.transaction("write");
  const now = Date.now();

  try {
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

      const used = await tx.execute({
        sql: "select nonce from verification_claims where nonce in (?, ?) limit 1",
        args: [String(pending.token_nonce), String(pending.revenue_nonce)],
      });
      if (used.rows.length) {
        throw new ApiError("These verification receipts were already claimed.", 409);
      }

      await tx.execute({
        sql: `insert into users (
              id, x_handle, x_user_id, display_name, avatar_url, created_at, updated_at
              ) values (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          pendingId,
          String(pending.x_handle),
          `submitted:${pendingId}`,
          pending.founder_name ? String(pending.founder_name) : `@${String(pending.x_handle)}`,
          pending.founder_avatar_url ? String(pending.founder_avatar_url) : null,
          now,
          now,
        ],
      });
      await tx.execute({
        sql: "insert into verification_claims (nonce, user_id, kind, used_at) values (?, ?, 'tokens', ?), (?, ?, 'revenue', ?)",
        args: [
          String(pending.token_nonce),
          pendingId,
          now,
          String(pending.revenue_nonce),
          pendingId,
          now,
        ],
      });

      const listingId = randomUUID();
      await tx.execute({
        sql: `insert into listings (
                id, owner_user_id, product_name, product_url, product_description,
                product_logo_url, products_json,
                tokens_spent_usd, revenue_usd, efficiency_score, model_provider,
                ai_spend_verification,
                verification_period_start, verification_period_end, verified_at,
                created_at, updated_at, bid_cents, stripe_checkout_session_id
              ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          listingId,
          pendingId,
          String(pending.product_name),
          String(pending.product_url),
          String(pending.product_description),
          pending.product_logo_url ? String(pending.product_logo_url) : null,
          pending.products_json ? String(pending.products_json) : null,
          Number(pending.tokens_spent_usd),
          Number(pending.revenue_usd),
          Number(pending.efficiency_score),
          String(pending.model_provider),
          pending.ai_spend_verification === "self_reported" ? "self_reported" : "api",
          Number(pending.verification_period_start),
          Number(pending.verification_period_end),
          now,
          now,
          now,
          Number(pending.bid_cents),
          session.id,
        ],
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
      sql: "update listings set bid_cents = bid_cents + ?, updated_at = ? where id = ?",
      args: [amountCents, now, listingId],
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
