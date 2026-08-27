import { z } from "zod";

import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/api";
import { getDatabase } from "@/lib/db";
import { getOrCreateReactionViewerId } from "@/lib/reaction-identity";

const visitSchema = z.object({
  listingId: z.string().uuid(),
  productUrl: z.string().trim().url().max(2_048),
  source: z.enum(["leaderboard", "quick_view", "listing", "battle"]),
});

function normalizedUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  url.hash = "";
  return url.toString();
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = visitSchema.parse(await request.json());
    const requestedUrl = normalizedUrl(input.productUrl);
    if (!requestedUrl) throw new ApiError("Invalid product URL.", 400);

    const db = getDatabase();
    const listing = await db.execute({
      sql: "select product_url, products_json from listings where id = ? limit 1",
      args: [input.listingId],
    });
    const row = listing.rows[0];
    if (!row) throw new ApiError("That build is no longer in the tank.", 404);

    const productUrls = new Set<string>();
    const primaryUrl = normalizedUrl(String(row.product_url));
    if (primaryUrl) productUrls.add(primaryUrl);
    if (row.products_json) {
      try {
        const products = JSON.parse(String(row.products_json));
        if (Array.isArray(products)) {
          for (const product of products) {
            if (!product || typeof product !== "object" || !("url" in product)) continue;
            if (typeof product.url !== "string") continue;
            const url = normalizedUrl(product.url);
            if (url) productUrls.add(url);
          }
        }
      } catch {
        // The primary URL remains the safe fallback for old listing rows.
      }
    }
    if (!productUrls.has(requestedUrl)) {
      throw new ApiError("That URL does not belong to this founder profile.", 400);
    }

    const visitorId = await getOrCreateReactionViewerId();
    const now = new Date();
    const visitDay = now.toISOString().slice(0, 10);
    const inserted = await db.execute({
      sql: `insert or ignore into product_visits (
              listing_id, product_url, visitor_id, visit_day, source, created_at
            ) values (?, ?, ?, ?, ?, ?)`,
      args: [input.listingId, requestedUrl, visitorId, visitDay, input.source, now.getTime()],
    });
    const count = await db.execute({
      sql: "select count(*) as count from product_visits where listing_id = ?",
      args: [input.listingId],
    });

    return Response.json({
      recorded: inserted.rowsAffected === 1,
      visitCount: Number(count.rows[0]?.count ?? 0),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
