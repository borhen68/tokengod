import { z } from "zod";

import { ApiError, apiErrorResponse, assertSameOrigin } from "@/lib/api";
import { lookupPublicXProfile } from "@/lib/x-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  handle: z.string().trim().max(16).transform((value) => value.replace(/^@/, "")).refine(
    (value) => /^[A-Za-z0-9_]{1,15}$/.test(value),
    { message: "Enter a valid X handle." },
  ),
});

const recentRequests = new Map<string, number[]>();

function enforceRateLimit(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || request.headers.get("x-real-ip") || "local";
  const cutoff = Date.now() - 60_000;
  const recent = (recentRequests.get(key) || []).filter((time) => time > cutoff);
  if (recent.length >= 20) throw new ApiError("Too many X profile lookups. Wait a minute and retry.", 429);
  if (recentRequests.size > 5_000) recentRequests.clear();
  recent.push(Date.now());
  recentRequests.set(key, recent);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit(request);
    const { handle } = requestSchema.parse(await request.json());
    const profile = await lookupPublicXProfile(handle);
    return Response.json({
      found: Boolean(profile),
      handle,
      name: profile?.name || `@${handle}`,
      avatarUrl: profile?.avatarUrl || null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
