import { cache } from "react";

import { getDatabase } from "@/lib/db";
import { proofStrength } from "@/lib/proof";
import { getReactionViewerId } from "@/lib/reaction-identity";
import { inferReportingPeriod } from "@/lib/reporting-period";
import { getSession } from "@/lib/session";
import type {
  Board,
  LeaderboardListing,
  ListingProduct,
  ReactionState,
  ReactionType,
  Viewer,
} from "@/lib/types";

type LeaderboardRow = Record<string, string | number | bigint | null>;

const listingSelect = `
  select
    l.id,
    l.owner_user_id,
    u.display_name as founder_name,
    u.x_handle,
    u.avatar_url,
    l.product_name,
    l.product_url,
    l.product_description,
    l.product_logo_url,
    l.products_json,
    l.tokens_spent_usd,
    l.revenue_usd,
    l.efficiency_score,
    l.model_provider,
    l.ai_spend_verification,
    l.revenue_verification,
    l.verification_period_start,
    l.verification_period_end,
    l.bid_cents,
    l.stripe_checkout_session_id,
    l.created_at,
    l.updated_at,
    coalesce(sum(case when r.type = 'love' then 1 else 0 end), 0) as love_count,
    coalesce(sum(case when r.type = 'laugh' then 1 else 0 end), 0) as laugh_count
  from listings l
  join users u on u.id = l.owner_user_id
  left join reactions r on r.listing_id = l.id
`;

function normalizeProducts(row: LeaderboardRow): ListingProduct[] {
  const fallback = {
    name: String(row.product_name),
    url: String(row.product_url),
    description: String(row.product_description),
    logoUrl: row.product_logo_url ? String(row.product_logo_url) : null,
  };

  if (!row.products_json) return [fallback];
  try {
    const products = JSON.parse(String(row.products_json));
    if (!Array.isArray(products)) return [fallback];
    const normalized = products.flatMap((product): ListingProduct[] => {
      if (!product || typeof product !== "object") return [];
      const candidate = product as Record<string, unknown>;
      if (typeof candidate.name !== "string" || typeof candidate.url !== "string") return [];
      return [{
        name: candidate.name,
        url: candidate.url,
        description: typeof candidate.description === "string" ? candidate.description : "",
        logoUrl: typeof candidate.logoUrl === "string" ? candidate.logoUrl : null,
      }];
    });
    return normalized.length ? normalized : [fallback];
  } catch {
    return [fallback];
  }
}

function normalizeRow(row: LeaderboardRow): LeaderboardListing {
  const verificationPeriodStart = new Date(
    Number(row.verification_period_start),
  ).toISOString();
  const verificationPeriodEnd = new Date(
    Number(row.verification_period_end),
  ).toISOString();

  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    founderName: String(row.founder_name || `@${row.x_handle}`),
    xHandle: String(row.x_handle),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    productName: String(row.product_name),
    productUrl: String(row.product_url),
    productDescription: String(row.product_description),
    productLogoUrl: row.product_logo_url ? String(row.product_logo_url) : null,
    products: normalizeProducts(row),
    tokensSpentUsd: Number(row.tokens_spent_usd),
    revenueUsd: Number(row.revenue_usd),
    efficiencyScore: Number(row.efficiency_score),
    modelProvider: String(row.model_provider) as LeaderboardListing["modelProvider"],
    aiSpendVerification: row.ai_spend_verification === "self_reported" ? "self_reported" : "api",
    revenueVerification: row.revenue_verification === "self_reported" ? "self_reported" : "stripe",
    reportingPeriod: inferReportingPeriod(
      verificationPeriodStart,
      verificationPeriodEnd,
    ),
    verificationPeriodStart,
    verificationPeriodEnd,
    isPaidEntry: Boolean(row.stripe_checkout_session_id),
    bidCents: Number(row.bid_cents),
    loveCount: Number(row.love_count),
    laughCount: Number(row.laugh_count),
    createdAt: new Date(Number(row.created_at)).toISOString(),
    updatedAt: new Date(Number(row.updated_at)).toISOString(),
  };
}

export function sortListings(listings: LeaderboardListing[], board: Board) {
  return [...listings].sort((a, b) => {
    if (board === "funded") {
      return b.bidCents - a.bidCents
        || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    const verificationTieBreak = proofStrength(b) - proofStrength(a);
    if (board === "respected") {
      return b.loveCount - a.loveCount || verificationTieBreak || b.efficiencyScore - a.efficiencyScore;
    }
    return b.laughCount - a.laughCount || verificationTieBreak || a.efficiencyScore - b.efficiencyScore;
  });
}

export const getLeaderboardListings = cache(
  async (): Promise<LeaderboardListing[]> => {
    try {
      const result = await getDatabase().execute({
        // Both boards rank the same pool differently, so load the complete MVP
        // pool and let each board select its own top 50.
        sql: `${listingSelect} group by l.id, u.id order by l.created_at asc`,
        args: [],
      });
      return result.rows.map((row) => normalizeRow(row as LeaderboardRow));
    } catch (error) {
      console.error("Leaderboard query failed", error instanceof Error ? error.name : "UnknownError");
      return [];
    }
  },
);

export const getListing = cache(
  async (id: string): Promise<LeaderboardListing | null> => {
    try {
      const result = await getDatabase().execute({
        sql: `${listingSelect} where l.id = ? group by l.id, u.id limit 1`,
        args: [id],
      });
      const row = result.rows[0];
      return row ? normalizeRow(row as LeaderboardRow) : null;
    } catch (error) {
      console.error("Listing query failed", error instanceof Error ? error.name : "UnknownError");
      return null;
    }
  },
);

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getSession();
  if (!session) return null;
  return {
    id: session.id,
    name: session.name,
    xHandle: session.xHandle,
    avatarUrl: session.avatarUrl,
  };
});

export async function getViewerReactions(listingIds: string[]): Promise<ReactionState> {
  const viewerId = await getReactionViewerId();
  if (!viewerId || listingIds.length === 0) return {};

  const placeholders = listingIds.map(() => "?").join(",");
  const result = await getDatabase().execute({
    sql: `select listing_id, type from reactions where user_id = ? and listing_id in (${placeholders})`,
    args: [viewerId, ...listingIds],
  });

  return result.rows.reduce<ReactionState>((state, row) => {
    const listingId = String(row.listing_id);
    state[listingId] ||= {};
    state[listingId][String(row.type) as ReactionType] = true;
    return state;
  }, {});
}
