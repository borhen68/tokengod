import { NextResponse } from "next/server";

import { finalizeCheckoutSession } from "@/lib/payments";
import { getPlatformStripe } from "@/lib/platform-stripe";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId?.startsWith("cs_")) {
    return NextResponse.redirect(new URL("/?payment=invalid", siteUrl));
  }

  try {
    const session = await getPlatformStripe().checkout.sessions.retrieve(sessionId);
    const result = await finalizeCheckoutSession(session);
    const destination = new URL(`/listing/${result.listingId}`, siteUrl);
    destination.searchParams.set("paid", "1");
    destination.searchParams.set("session_id", sessionId);
    return NextResponse.redirect(destination);
  } catch {
    return NextResponse.redirect(new URL("/?payment=failed", siteUrl));
  }
}
