import {
  ProviderVerificationError,
  providerErrorMessage,
} from "@/lib/providers/errors";

type StripeCharge = {
  id: string;
  amount_captured: number;
  amount_refunded: number;
  currency: string;
  paid: boolean;
  status: string;
};

type StripeChargePage = {
  data?: StripeCharge[];
  has_more?: boolean;
};

export async function verifyStripeRevenue(
  apiKey: string,
  periodStart: string,
  periodEnd: string,
) {
  if (!apiKey.startsWith("rk_live_")) {
    throw new ProviderVerificationError(
      "Use a live restricted Stripe key (rk_live_…) with read access to Charges. Test and full-access secret keys are rejected.",
    );
  }

  let startingAfter: string | null = null;
  let totalCents = 0;

  for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
    const url = new URL("https://api.stripe.com/v1/charges");
    url.searchParams.set("limit", "100");
    url.searchParams.set(
      "created[gte]",
      String(Math.floor(new Date(periodStart).getTime() / 1000)),
    );
    url.searchParams.set(
      "created[lt]",
      String(Math.floor(new Date(periodEnd).getTime() / 1000)),
    );
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new ProviderVerificationError(
        await providerErrorMessage(response, "Stripe could not verify this key."),
        response.status,
      );
    }

    const body = (await response.json()) as StripeChargePage;
    for (const charge of body.data ?? []) {
      if (!charge.paid || charge.status !== "succeeded") continue;
      if (charge.currency.toLowerCase() !== "usd") {
        throw new ProviderVerificationError(
          "This MVP can verify USD Stripe charges only. Multi-currency conversion is not guessed.",
        );
      }
      totalCents += Math.max(0, charge.amount_captured - charge.amount_refunded);
    }

    const finalCharge = body.data?.at(-1);
    if (!body.has_more || !finalCharge) break;
    startingAfter = finalCharge.id;
  }

  return Math.round(totalCents) / 100;
}

