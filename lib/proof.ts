import type { LeaderboardListing } from "@/lib/types";
import { getRevenueProvider } from "@/lib/revenue-providers";

type ListingProof = Pick<
  LeaderboardListing,
  "aiSpendVerification" | "revenueVerification"
>;

export function hasFounderReportedNumbers(listing: ListingProof) {
  return listing.aiSpendVerification === "self_reported"
    || listing.revenueVerification === "self_reported";
}

export function listingProofLabel(listing: ListingProof) {
  if (
    listing.aiSpendVerification === "self_reported"
    && listing.revenueVerification === "self_reported"
  ) {
    return "AI + revenue founder reported";
  }
  if (listing.revenueVerification === "self_reported") {
    return "AI spend verified · revenue founder reported";
  }
  const revenueProvider = getRevenueProvider(listing.revenueVerification).name;
  if (listing.aiSpendVerification === "self_reported") {
    return `AI spend founder reported · ${revenueProvider} revenue verified`;
  }
  return `AI spend + ${revenueProvider} revenue verified`;
}

export function revenueProofLabel(listing: ListingProof) {
  return listing.revenueVerification === "self_reported"
    ? "founder reported"
    : `${getRevenueProvider(listing.revenueVerification).name} · verified`;
}

export function proofStrength(listing: ListingProof) {
  return Number(listing.revenueVerification !== "self_reported") * 2
    + Number(listing.aiSpendVerification === "api");
}
