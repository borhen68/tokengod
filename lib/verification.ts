import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { VerificationReceiptPayload } from "@/lib/types";

const receiptSchema = z.object({
  version: z.literal(1),
  kind: z.enum(["tokens", "revenue"]),
  userId: z.string().uuid(),
  provider: z.enum(["openai", "anthropic", "stripe"]),
  amountUsd: z.number().nonnegative().finite(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  verifiedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  nonce: z.string().min(24),
});

function receiptSecret() {
  const secret = process.env.VERIFICATION_RECEIPT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "VERIFICATION_RECEIPT_SECRET must contain at least 32 characters.",
    );
  }
  return secret;
}

export function getVerificationWindow() {
  const periodEnd = new Date();
  periodEnd.setUTCHours(0, 0, 0, 0);

  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - 90);

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

export function issueVerificationReceipt(
  input: Omit<
    VerificationReceiptPayload,
    "version" | "verifiedAt" | "expiresAt" | "nonce"
  >,
) {
  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt.getTime() + 30 * 60 * 1000);
  const payload: VerificationReceiptPayload = {
    ...input,
    version: 1,
    amountUsd: Math.round(input.amountUsd * 100) / 100,
    verifiedAt: verifiedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    nonce: randomBytes(18).toString("base64url"),
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", receiptSecret())
    .update(encoded)
    .digest("base64url");

  return {
    receipt: `${encoded}.${signature}`,
    payload,
  };
}

export function verifyVerificationReceipt(
  receipt: string,
  expected: {
    userId: string;
    kind: VerificationReceiptPayload["kind"];
  },
) {
  const [encoded, signature, extra] = receipt.split(".");
  if (!encoded || !signature || extra) throw new Error("Invalid receipt.");

  const expectedSignature = createHmac("sha256", receiptSecret())
    .update(encoded)
    .digest();
  const suppliedSignature = Buffer.from(signature, "base64url");

  if (
    expectedSignature.length !== suppliedSignature.length ||
    !timingSafeEqual(expectedSignature, suppliedSignature)
  ) {
    throw new Error("Invalid receipt signature.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid receipt payload.");
  }

  const payload = receiptSchema.parse(raw);
  if (payload.userId !== expected.userId || payload.kind !== expected.kind) {
    throw new Error("Receipt does not belong to this verification.");
  }
  if (new Date(payload.expiresAt).getTime() <= Date.now()) {
    throw new Error("Verification expired. Reconnect and try again.");
  }
  if (
    payload.kind === "tokens" &&
    payload.provider !== "openai" &&
    payload.provider !== "anthropic"
  ) {
    throw new Error("Invalid token provider.");
  }
  if (payload.kind === "revenue" && payload.provider !== "stripe") {
    throw new Error("Invalid revenue provider.");
  }

  return payload;
}

