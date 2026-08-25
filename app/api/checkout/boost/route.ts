import { z } from "zod";

import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  requirePaymentConfiguration,
} from "@/lib/api";
import { getDatabase } from "@/lib/db";
import { getPlatformStripe } from "@/lib/platform-stripe";

const boostSchema = z.object({
  listingId: z.string().uuid(),
  amountCents: z.number().int().min(100).max(100_000).multipleOf(100),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requirePaymentConfiguration();
    const input = boostSchema.parse(await request.json());
    const result = await getDatabase().execute({
      sql: "select product_name from listings where id = ? limit 1",
      args: [input.listingId],
    });
    if (!result.rows[0]) throw new ApiError("That build is no longer in the tank.", 404);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const checkout = await getPlatformStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amountCents,
          product_data: {
            name: `Back ${String(result.rows[0].product_name)} on TokenGod`,
            description: "Every dollar adds pressure to its Surface 3 position.",
          },
        },
      }],
      metadata: {
        app: "tokengod",
        kind: "boost",
        listing_id: input.listingId,
        amount_cents: String(input.amountCents),
      },
      payment_intent_data: {
        metadata: {
          app: "tokengod",
          kind: "boost",
          listing_id: input.listingId,
          amount_cents: String(input.amountCents),
        },
      },
      success_url: `${siteUrl}/payment/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?boost=${encodeURIComponent(input.listingId)}&payment=cancelled`,
    });
    if (!checkout.url) throw new ApiError("Stripe did not return a checkout URL.", 502);
    return Response.json({ url: checkout.url });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
