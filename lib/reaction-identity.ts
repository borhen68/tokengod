import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "tokengod_reactor";
const COOKIE_SECONDS = 365 * 24 * 60 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reactionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.VERIFICATION_RECEIPT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("A signing secret of at least 32 characters is required for reactions.");
  }
  return secret;
}

function sign(id: string) {
  return createHmac("sha256", reactionSecret()).update(id).digest("base64url");
}

function readId(value: string | undefined) {
  if (!value) return null;
  const [id, signature, extra] = value.split(".");
  if (!id || !signature || extra || !UUID_PATTERN.test(id)) return null;

  const expected = Buffer.from(sign(id));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  return id;
}

export async function getReactionViewerId() {
  return readId((await cookies()).get(COOKIE_NAME)?.value);
}

export async function getOrCreateReactionViewerId() {
  const cookieStore = await cookies();
  const existing = readId(cookieStore.get(COOKIE_NAME)?.value);
  if (existing) return existing;

  const id = randomUUID();
  cookieStore.set(COOKIE_NAME, `${id}.${sign(id)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_SECONDS,
    priority: "medium",
  });
  return id;
}

export function anonymousReactionUser(id: string) {
  return {
    id,
    xHandle: `viewer_${id.replaceAll("-", "")}`,
    xUserId: `anonymous:${id}`,
    displayName: "Anonymous viewer",
  };
}
