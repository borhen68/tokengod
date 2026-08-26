import {
  ProviderVerificationError,
  providerErrorMessage,
} from "@/lib/providers/errors";

type OpenAICostPage = {
  data?: Array<{
    results?: Array<{
      amount?: { value?: number | string; currency?: string };
    }>;
  }>;
  has_more?: boolean;
  next_page?: string | null;
};

export async function verifyOpenAICost(
  apiKey: string,
  periodStart: string,
  periodEnd: string,
) {
  if (!apiKey.startsWith("sk-admin-")) {
    throw new ProviderVerificationError(
      "OpenAI verification needs an organization Admin API key (sk-admin-…), not a project key.",
    );
  }

  let page: string | null = null;
  let total = 0;
  let complete = false;

  for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set(
      "start_time",
      String(Math.floor(new Date(periodStart).getTime() / 1000)),
    );
    url.searchParams.set(
      "end_time",
      String(Math.floor(new Date(periodEnd).getTime() / 1000)),
    );
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "180");
    if (page) url.searchParams.set("page", page);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new ProviderVerificationError(
        await providerErrorMessage(response, "OpenAI could not verify this key."),
        response.status,
      );
    }

    const body = (await response.json()) as OpenAICostPage;
    for (const bucket of body.data ?? []) {
      for (const result of bucket.results ?? []) {
        const amount = result.amount;
        if (!amount) continue;
        if ((amount.currency ?? "usd").toLowerCase() !== "usd") continue;
        const value = Number(amount.value ?? 0);
        if (Number.isFinite(value)) total += value;
      }
    }

    if (!body.has_more) {
      complete = true;
      break;
    }
    if (!body.next_page) {
      throw new ProviderVerificationError(
        "OpenAI did not return the cursor needed to finish verification.",
        502,
      );
    }
    page = body.next_page;
  }

  if (!complete) {
    throw new ProviderVerificationError(
      "OpenAI returned more history than TokenGod could safely verify. Choose a shorter window.",
      422,
    );
  }

  return Math.round(total * 100) / 100;
}
