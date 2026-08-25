import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";

import type { Viewer } from "@/lib/types";

const COOKIE_NAME = "tokengod_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

const sessionSchema = z.object({
  id: z.string().uuid(),
  xUserId: z.string().min(1).max(100),
  xHandle: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  avatarUrl: z.string().url().nullable(),
  expiresAt: z.number().int().positive(),
});

type SessionPayload = z.infer<typeof sessionSchema>;

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function sign(encoded: string) {
  return createHmac("sha256", sessionSecret()).update(encoded).digest("base64url");
}

export async function createSession(viewer: Viewer & { xUserId: string }) {
  const payload: SessionPayload = {
    ...viewer,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${encoded}.${sign(encoded)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;

  const expected = Buffer.from(sign(encoded), "base64url");
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const payload = sessionSchema.parse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    );
    return payload.expiresAt > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

