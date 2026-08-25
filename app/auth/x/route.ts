import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isDatabaseConfigured, isXAuthConfigured } from "@/lib/config";

const oauthCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
};

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/submit";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeNext(requestUrl.searchParams.get("next"));
  if (!isDatabaseConfigured() || !isXAuthConfigured()) {
    const target = new URL(next, requestUrl.origin);
    target.searchParams.set("error", "X OAuth is waiting for its client credentials.");
    return NextResponse.redirect(target);
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const cookieStore = await cookies();
  cookieStore.set("tokengod_oauth_state", state, oauthCookie);
  cookieStore.set("tokengod_oauth_verifier", verifier, oauthCookie);
  cookieStore.set("tokengod_oauth_next", next, oauthCookie);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin;
  const authorize = new URL("https://twitter.com/i/oauth2/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", process.env.X_CLIENT_ID!);
  authorize.searchParams.set("redirect_uri", new URL("/auth/callback", siteUrl).toString());
  authorize.searchParams.set("scope", "tweet.read users.read");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(authorize);
}
