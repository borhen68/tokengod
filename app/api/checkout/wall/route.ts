import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";
import { z } from "zod";

import { ApiError, apiErrorResponse, assertSameOrigin, requirePaymentConfiguration } from "@/lib/api";
import { getDatabase } from "@/lib/db";
import { getDataFastStripeMetadata } from "@/lib/datafast-server";
import { getPlatformStripe } from "@/lib/platform-stripe";

const publicUrl = z.string().trim().url().max(2048).refine((value) => ["http:", "https:"].includes(new URL(value).protocol));
const schema = z.object({
  name: z.string().trim().min(2).max(80),
  url: publicUrl,
  description: z.string().trim().max(320).default(""),
  logoUrl: publicUrl.nullable().optional(),
  amountCents: z.number().int().min(100).max(100_000).multipleOf(100),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requirePaymentConfiguration();
    const input = schema.parse(await request.json());
    const productUrl = new URL(input.url).toString();
    const db = getDatabase();
    const hostname = new URL(productUrl).hostname.toLowerCase().replace(/^www\./, "");
    const existingUrls = await db.execute("select product_url from wall_products union all select product_url from listings");
    const duplicate = existingUrls.rows.some((row) => {
      try { return new URL(String(row.product_url)).hostname.toLowerCase().replace(/^www\./, "") === hostname; }
      catch { return false; }
    });
    if (duplicate) throw new ApiError("That product is already on the wall.", 409);

    const pendingId = randomUUID();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const dataFastMetadata = getDataFastStripeMetadata(request);
    const metadata = { app: "tokengod", kind: "wall_entry", pending_wall_product_id: pendingId, amount_cents: String(input.amountCents), ...dataFastMetadata };
    const checkout = await getPlatformStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amountCents,
          product_data: { name: `${input.name} bubble on TokenGod`, description: "A permanent product bubble. Bigger payment, bigger bubble." },
        },
      }],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${siteUrl}/payment/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?join=1&payment=cancelled`,
    });
    if (!checkout.url) throw new ApiError("Stripe did not return a checkout URL.", 502);
    const now = Date.now();
    await db.execute({
      sql: `insert into pending_wall_products
        (id, product_name, product_url, product_description, product_logo_url, paid_cents, stripe_checkout_session_id, status, created_at, expires_at)
        values (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      args: [pendingId, input.name, productUrl, input.description, input.logoUrl || null, input.amountCents, checkout.id, now, now + 86_400_000],
    });
    return Response.json({ url: checkout.url });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
