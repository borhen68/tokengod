import Stripe from "stripe";

import { finalizeCheckoutSession } from "@/lib/payments";
import { getPlatformStripe } from "@/lib/platform-stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return Response.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = getPlatformStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch {
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed"
    || event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    if (session.metadata?.app !== "tokengod") {
      return Response.json({ received: true, ignored: true });
    }
    await finalizeCheckoutSession(session);
  }

  return Response.json({ received: true });
}
