import type { LeaderboardListing } from "@/lib/types";

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
  if (listing.aiSpendVerification === "self_reported") {
    return "AI spend founder reported · revenue verified";
  }
  return "AI spend + revenue verified";
}

export function revenueProofLabel(listing: ListingProof) {
  return listing.revenueVerification === "stripe"
    ? "Stripe · verified"
    : "founder reported";
}

export function proofStrength(listing: ListingProof) {
  return Number(listing.revenueVerification === "stripe") * 2
    + Number(listing.aiSpendVerification === "api");
}
