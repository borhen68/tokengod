import type { ReportingPeriod } from "@/lib/reporting-period";
import type { RevenueProvider } from "@/lib/revenue-providers";
import type { ProjectOutcome } from "@/lib/project-outcomes";

export type Board = "funded" | "respected" | "roasted";
export type ModelProvider = "anthropic" | "openai" | "other";
export type ReactionType = "love" | "laugh";
export type AiSpendVerification = "api" | "self_reported";
export type RevenueVerification = RevenueProvider | "self_reported";
export type EntrySource = "paid" | "launch_free" | "seed";

export type ListingProduct = {
  name: string;
  url: string;
  description: string;
  logoUrl: string | null;
};

export type LeaderboardListing = {
  id: string;
  ownerUserId: string;
  founderName: string;
  xHandle: string;
  avatarUrl: string | null;
  isAnonymous: boolean;
  productName: string;
  productUrl: string;
  productDescription: string;
  productLogoUrl: string | null;
  products: ListingProduct[];
  tokensSpentUsd: number;
  revenueUsd: number;
  efficiencyScore: number;
  projectOutcome: ProjectOutcome;
  founderLesson: string;
  modelProvider: ModelProvider;
  aiSpendVerification: AiSpendVerification;
  revenueVerification: RevenueVerification;
  reportingPeriod: ReportingPeriod;
  verificationPeriodStart: string;
  verificationPeriodEnd: string;
  isPaidEntry: boolean;
  entrySource: EntrySource;
  bidCents: number;
  loveCount: number;
  laughCount: number;
  weeklyLoveCount: number;
  weeklyLaughCount: number;
  weeklyBattleWins: number;
  visitCount: number;
  weeklyVisitCount: number;
  efficiencyRank: number;
  efficiencyPercentile: number;
  listingCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Viewer = {
  id: string;
  name: string;
  xHandle: string;
  avatarUrl: string | null;
};

export type ReactionState = Record<string, Partial<Record<ReactionType, boolean>>>;
export type BattleVoteState = Record<string, string>;

export type VerificationReceiptPayload = {
  version: 1;
  kind: "tokens" | "revenue";
  userId: string;
  provider: "openai" | "anthropic" | RevenueProvider;
  verificationMethod: "api" | "self_reported";
  amountUsd: number;
  periodStart: string;
  periodEnd: string;
  verifiedAt: string;
  expiresAt: string;
  nonce: string;
};
