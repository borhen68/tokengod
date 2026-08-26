import {
  ProviderVerificationError,
  providerErrorMessage,
} from "@/lib/providers/errors";

type AnthropicCostPage = {
  data?: Array<{
    results?: Array<{
      amount?: string | number;
      currency?: string;
      cost_type?: "code_execution" | "session_usage" | "tokens" | "web_search" | null;
    }>;
  }>;
  has_more?: boolean;
  next_page?: string | null;
};

export async function verifyAnthropicCost(
  apiKey: string,
  periodStart: string,
  periodEnd: string,
) {
  if (!apiKey.startsWith("sk-ant-admin")) {
    throw new ProviderVerificationError(
      "Anthropic verification needs an organization Admin API key (sk-ant-admin…), not a workspace key.",
    );
  }

  let page: string | null = null;
  let total = 0;
  let complete = false;

  for (let pageIndex = 0; pageIndex < 120; pageIndex += 1) {
    const url = new URL(
      "https://api.anthropic.com/v1/organizations/cost_report",
    );
    url.searchParams.set("starting_at", periodStart);
    url.searchParams.set("ending_at", periodEnd);
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");
    url.searchParams.append("group_by[]", "description");
    if (page) url.searchParams.set("page", page);

    const response = await fetch(url, {
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new ProviderVerificationError(
        await providerErrorMessage(
          response,
          "Anthropic could not verify this key.",
        ),
        response.status,
      );
    }

    const body = (await response.json()) as AnthropicCostPage;
    for (const bucket of body.data ?? []) {
      for (const result of bucket.results ?? []) {
        if (result.cost_type !== "tokens") continue;
        if ((result.currency ?? "USD").toUpperCase() !== "USD") continue;
        const value = Number(result.amount ?? 0);
        if (Number.isFinite(value)) total += value;
      }
    }

    if (!body.has_more) {
      complete = true;
      break;
    }
    if (!body.next_page) {
      throw new ProviderVerificationError(
        "Anthropic did not return the cursor needed to finish verification.",
        502,
      );
    }
    page = body.next_page;
  }

  if (!complete) {
    throw new ProviderVerificationError(
      "Anthropic returned more history than TokenGod could safely verify. Choose a shorter window.",
      422,
    );
  }

  // Anthropic reports decimal strings in the currency's lowest unit (USD cents).
  return Math.round(total) / 100;
}
