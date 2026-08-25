export type Board = "respected" | "roasted";
export type ModelProvider = "anthropic" | "openai" | "other";
export type ReactionType = "love" | "laugh";

export type LeaderboardListing = {
  id: string;
  ownerUserId: string;
  founderName: string;
  xHandle: string;
  avatarUrl: string | null;
  productName: string;
  productUrl: string;
  productDescription: string;
  productLogoUrl: string | null;
  tokensSpentUsd: number;
  revenueUsd: number;
  efficiencyScore: number;
  modelProvider: ModelProvider;
  bidCents: number;
  loveCount: number;
  laughCount: number;
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

export type VerificationReceiptPayload = {
  version: 1;
  kind: "tokens" | "revenue";
  userId: string;
  provider: "openai" | "anthropic" | "stripe";
  amountUsd: number;
  periodStart: string;
  periodEnd: string;
  verifiedAt: string;
  expiresAt: string;
  nonce: string;
};
