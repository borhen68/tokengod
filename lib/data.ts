import { cache } from "react";

import {
  ANONYMOUS_FOUNDER_NAME,
  isAnonymousFounderHandle,
} from "@/lib/anonymous-founder";
import { getDatabase } from "@/lib/db";
import { proofStrength } from "@/lib/proof";
import { getReactionViewerId } from "@/lib/reaction-identity";
import { inferReportingPeriod } from "@/lib/reporting-period";
import { isRevenueProvider } from "@/lib/revenue-providers";
import { getSession } from "@/lib/session";
import type {
  Board,
  BattleVoteState,
  LeaderboardListing,
  ListingProduct,
  ReactionState,
  ReactionType,
  Viewer,
} from "@/lib/types";
import { getBattlePairKey, getCurrentWeekKey, getCurrentWeekStart } from "@/lib/weekly";

type LeaderboardRow = Record<string, string | number | bigint | null>;

function listingSelect() {
  const weekStart = getCurrentWeekStart().getTime();
  const weekKey = getCurrentWeekKey();
  return `
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
    l.revenue_provider,
    l.verification_period_start,
    l.verification_period_end,
    l.funded_cents,
    l.entry_source,
    l.stripe_checkout_session_id,
    l.created_at,
    l.updated_at,
    coalesce(sum(case when r.type = 'love' then 1 else 0 end), 0) as love_count,
    coalesce(sum(case when r.type = 'laugh' then 1 else 0 end), 0) as laugh_count,
    coalesce(sum(case when r.type = 'love' and r.created_at >= ${weekStart} then 1 else 0 end), 0) as weekly_love_count,
    coalesce(sum(case when r.type = 'laugh' and r.created_at >= ${weekStart} then 1 else 0 end), 0) as weekly_laugh_count,
    (select count(*) from battle_votes bv where bv.chosen_listing_id = l.id and bv.week_key = '${weekKey}') as weekly_battle_wins,
    (select count(*) from product_visits pv where pv.listing_id = l.id) as visit_count,
    (select count(*) from product_visits pv where pv.listing_id = l.id and pv.created_at >= ${weekStart}) as weekly_visit_count,
    (select count(*) + 1 from listings ranked where ranked.efficiency_score > l.efficiency_score) as efficiency_rank,
    (select count(*) from listings) as listing_count
  from listings l
  join users u on u.id = l.owner_user_id
  left join reactions r on r.listing_id = l.id
`;
}

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
  const storedXHandle = String(row.x_handle);
  const isAnonymous = isAnonymousFounderHandle(storedXHandle);
  const verificationPeriodStart = new Date(
    Number(row.verification_period_start),
  ).toISOString();
  const verificationPeriodEnd = new Date(
    Number(row.verification_period_end),
  ).toISOString();
  const listingCount = Math.max(1, Number(row.listing_count));
  const efficiencyRank = Math.max(1, Number(row.efficiency_rank));
  const efficiencyPercentile = listingCount <= 1
    ? 100
    : Math.max(1, Math.round(((listingCount - efficiencyRank) / (listingCount - 1)) * 99) + 1);

  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    founderName: isAnonymous
      ? ANONYMOUS_FOUNDER_NAME
      : String(row.founder_name || `@${storedXHandle}`),
    xHandle: isAnonymous ? "" : storedXHandle,
    avatarUrl: isAnonymous ? null : row.avatar_url ? String(row.avatar_url) : null,
    isAnonymous,
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
    revenueVerification: row.revenue_verification === "self_reported"
      ? "self_reported"
      : isRevenueProvider(row.revenue_provider) ? row.revenue_provider : "stripe",
    reportingPeriod: inferReportingPeriod(
      verificationPeriodStart,
      verificationPeriodEnd,
    ),
    verificationPeriodStart,
    verificationPeriodEnd,
    isPaidEntry: row.entry_source === "paid",
    entrySource: row.entry_source === "launch_free"
      ? "launch_free"
      : row.entry_source === "seed" ? "seed" : "paid",
    bidCents: Number(row.funded_cents),
    loveCount: Number(row.love_count),
    laughCount: Number(row.laugh_count),
    weeklyLoveCount: Number(row.weekly_love_count),
    weeklyLaughCount: Number(row.weekly_laugh_count),
    weeklyBattleWins: Number(row.weekly_battle_wins),
    visitCount: Number(row.visit_count),
    weeklyVisitCount: Number(row.weekly_visit_count),
    efficiencyRank,
    efficiencyPercentile,
    listingCount,
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
        sql: `${listingSelect()} group by l.id, u.id order by l.created_at asc`,
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
        sql: `${listingSelect()} where l.id = ? group by l.id, u.id limit 1`,
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

export async function getViewerBattleVotes(listingIds: string[]): Promise<BattleVoteState> {
  const viewerId = await getReactionViewerId();
  if (!viewerId || listingIds.length < 2) return {};

  const placeholders = listingIds.map(() => "?").join(",");
  const result = await getDatabase().execute({
    sql: `select listing_a_id, listing_b_id, chosen_listing_id
          from battle_votes
          where viewer_id = ?
            and week_key = ?
            and listing_a_id in (${placeholders})
            and listing_b_id in (${placeholders})`,
    args: [viewerId, getCurrentWeekKey(), ...listingIds, ...listingIds],
  });

  return result.rows.reduce<BattleVoteState>((state, row) => {
    state[getBattlePairKey(String(row.listing_a_id), String(row.listing_b_id))] = String(row.chosen_listing_id);
    return state;
  }, {});
}
