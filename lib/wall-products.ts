import "server-only";

import { getLeaderboardListings } from "@/lib/data";
import { getDatabase } from "@/lib/db";
import type { WallProduct } from "@/lib/types";

function productKey(url: string, name: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
}

function mergeProducts(products: WallProduct[]) {
  const merged = new Map<string, WallProduct>();
  for (const product of products) {
    const key = productKey(product.url, product.name);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, product);
      continue;
    }
    merged.set(key, {
      ...current,
      name: current.name.length <= product.name.length ? current.name : product.name,
      description: current.description.length >= product.description.length ? current.description : product.description,
      logoUrl: current.logoUrl || product.logoUrl,
      paidCents: Math.max(current.paidCents, product.paidCents),
      score: Math.max(current.score, product.score),
    });
  }
  return [...merged.values()];
}

export async function getWallProducts(): Promise<WallProduct[]> {
  const listings = await getLeaderboardListings();
  const established: WallProduct[] = listings.map((listing) => ({
    id: `listing-${listing.id}`,
    name: listing.productName,
    url: listing.productUrl,
    description: listing.productDescription,
    logoUrl: listing.productLogoUrl || listing.avatarUrl,
    builderLabel: listing.isAnonymous ? "private builder" : `@${listing.xHandle}`,
    score: Math.max(1, listing.loveCount * 8 + listing.weeklyVisitCount * 3 + listing.visitCount),
    paidCents: Math.max(100, listing.bidCents),
  }));

  try {
    const result = await getDatabase().execute(
      "select id, product_name, product_url, product_description, product_logo_url, builder_label, visit_count, paid_cents from wall_products order by created_at asc",
    );
    const simple = result.rows.map<WallProduct>((row) => ({
      id: `wall-${String(row.id)}`,
      name: String(row.product_name),
      url: String(row.product_url),
      description: String(row.product_description || ""),
      logoUrl: row.product_logo_url ? String(row.product_logo_url) : null,
      builderLabel: String(row.builder_label || "independent builder"),
      score: Math.max(1, Number(row.visit_count || 0) + 1),
      paidCents: Math.max(100, Number(row.paid_cents || 100)),
    }));
    return mergeProducts([...established, ...simple]);
  } catch {
    return mergeProducts(established);
  }
}
