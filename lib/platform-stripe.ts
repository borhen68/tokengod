import "server-only";

import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getPlatformStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
  stripe ||= new Stripe(secretKey, {
    appInfo: { name: "TokenGod", version: "0.1.0" },
  });
  return stripe;
}
