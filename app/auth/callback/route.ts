import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isDatabaseConfigured, isXAuthConfigured } from "@/lib/config";
import { getDatabase } from "@/lib/db";
import { createSession } from "@/lib/session";

type XTokenResponse = { access_token?: string };
type XUserResponse = {
  data?: { id: string; username: string; name: string; profile_image_url?: string };
};

function failed(origin: string, message: string, next = "/submit") {
  const target = new URL(next, origin);
  target.searchParams.set("error", message);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  if (!isDatabaseConfigured() || !isXAuthConfigured()) {
    return failed(requestUrl.origin, "X login is not configured.");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("tokengod_oauth_state")?.value;
  const verifier = cookieStore.get("tokengod_oauth_verifier")?.value;
  const nextCookie = cookieStore.get("tokengod_oauth_next")?.value;
  const next = nextCookie?.startsWith("/") && !nextCookie.startsWith("//")
    ? nextCookie
    : "/submit";
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");

  cookieStore.delete("tokengod_oauth_state");
  cookieStore.delete("tokengod_oauth_verifier");
  cookieStore.delete("tokengod_oauth_next");

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return failed(requestUrl.origin, "X login could not be verified. Please try again.", next);
  }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin;
    const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: new URL("/auth/callback", siteUrl).toString(),
        code_verifier: verifier,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenResponse.ok) throw new Error("Token exchange failed.");
    const token = (await tokenResponse.json()) as XTokenResponse;
    if (!token.access_token) throw new Error("X did not return an access token.");

    const userResponse = await fetch(
      "https://api.x.com/2/users/me?user.fields=profile_image_url,name,username",
      {
        headers: { Authorization: `Bearer ${token.access_token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!userResponse.ok) throw new Error("X profile request failed.");
    const xUser = ((await userResponse.json()) as XUserResponse).data;
    if (!xUser?.id || !xUser.username) throw new Error("X profile was incomplete.");

    const db = getDatabase();
    const candidateId = randomUUID();
    const now = Date.now();
    const upserted = await db.execute({
      sql: `insert into users (id, x_handle, x_user_id, display_name, avatar_url, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?)
            on conflict(x_user_id) do update set
              x_handle = excluded.x_handle,
              display_name = excluded.display_name,
              avatar_url = excluded.avatar_url,
              updated_at = excluded.updated_at
            returning id`,
      args: [candidateId, xUser.username, xUser.id, xUser.name, xUser.profile_image_url ?? null, now, now],
    });
    const id = String(upserted.rows[0].id);

    await createSession({
      id,
      xUserId: xUser.id,
      xHandle: xUser.username,
      name: xUser.name,
      avatarUrl: xUser.profile_image_url ?? null,
    });

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  } catch (error) {
    console.error("X OAuth callback failed", error instanceof Error ? error.name : "UnknownError");
    return failed(requestUrl.origin, "X login could not be completed. Please try again.", next);
  }
}
