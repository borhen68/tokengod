import { ZodError } from "zod";

import { isApplicationConfigured, isDatabaseConfigured, isPaymentConfigured } from "@/lib/config";
import { getSession } from "@/lib/session";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requireAuthenticatedUser() {
  if (!isDatabaseConfigured()) throw new ApiError("The database is not configured yet.", 503);
  const session = await getSession();
  if (!session) throw new ApiError("Sign in with X to continue.", 401);
  return session;
}

export function requireSubmissionConfiguration() {
  if (!isApplicationConfigured()) {
    throw new ApiError("Submission verification is not configured yet.", 503);
  }
}

export function requirePaymentConfiguration() {
  if (!isPaymentConfigured()) {
    throw new ApiError("Stripe payments are not configured yet.", 503);
  }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
    : requestOrigin;
  if (origin !== requestOrigin && origin !== configuredOrigin) {
    throw new ApiError("Invalid request origin.", 403);
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json(
      { error: error.issues[0]?.message || "Invalid request." },
      { status: 400 },
    );
  }
  console.error("API request failed", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
