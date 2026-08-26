import "server-only";

import { getRevenueProvider, type RevenueProvider } from "@/lib/revenue-providers";
import {
  ProviderVerificationError,
  providerErrorMessage,
} from "@/lib/providers/errors";
import { verifyStripeRevenue } from "@/lib/providers/stripe";

const MAX_PAGES = 100;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is JsonRecord => item !== null)
    : [];
}

function minorUnits(value: unknown, provider: RevenueProvider, field: string) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(amount)) {
    throw new ProviderVerificationError(
      `${getRevenueProvider(provider).name} returned an invalid ${field} amount.`,
      502,
    );
  }
  return amount;
}

function dateMillis(value: unknown, provider: RevenueProvider) {
  if (typeof value !== "string") {
    throw new ProviderVerificationError(
      `${getRevenueProvider(provider).name} returned a payment without a date.`,
      502,
    );
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new ProviderVerificationError(
      `${getRevenueProvider(provider).name} returned an invalid payment date.`,
      502,
    );
  }
  return timestamp;
}

function inWindow(value: unknown, periodStart: string, periodEnd: string, provider: RevenueProvider) {
  const timestamp = dateMillis(value, provider);
  return timestamp >= new Date(periodStart).getTime()
    && timestamp < new Date(periodEnd).getTime();
}

function requireUsd(value: unknown, provider: RevenueProvider) {
  const currency = typeof value === "string" ? value.toLowerCase() : "";
  if (currency !== "usd") {
    const name = getRevenueProvider(provider).name;
    throw new ProviderVerificationError(
      `${name} returned a ${currency ? currency.toUpperCase() : "non-USD"} payment. TokenGod currently verifies USD revenue only and never guesses exchange rates.`,
      422,
    );
  }
}

async function providerJson(
  url: URL,
  apiKey: string,
  provider: RevenueProvider,
  headers?: HeadersInit,
) {
  const name = getRevenueProvider(provider).name;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new ProviderVerificationError(
      await providerErrorMessage(response, `${name} could not verify this key.`),
      response.status,
    );
  }

  try {
    return record(await response.json());
  } catch {
    throw new ProviderVerificationError(
      `${name} returned an unreadable response. Try again shortly.`,
      502,
    );
  }
}

async function verifyPolarRevenue(
  apiKey: string,
  periodStart: string,
  periodEnd: string,
) {
  let totalCents = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL("https://api.polar.sh/v1/orders/");
    url.searchParams.set("created_after", periodStart);
    url.searchParams.set("created_before", periodEnd);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", "100");
    const body = await providerJson(url, apiKey, "polar");
    if (!body) throw new ProviderVerificationError("Polar returned an empty response.", 502);

    const items = records(body.items);
    for (const order of items) {
      if (!inWindow(order.created_at, periodStart, periodEnd, "polar")) continue;
      if (!["paid", "partially_refunded", "refunded"].includes(String(order.status))) continue;
      requireUsd(order.currency, "polar");
      const total = minorUnits(order.total_amount, "polar", "order total");
      const refunded = minorUnits(order.refunded_amount ?? 0, "polar", "refunded");
      totalCents += Math.max(0, total - refunded);
    }

    const pagination = record(body.pagination);
    const maxPage = Number(pagination?.max_page ?? page);
    if (!Number.isFinite(maxPage) || maxPage < 1) {
      throw new ProviderVerificationError("Polar returned invalid pagination data.", 502);
    }
    if (page >= maxPage) return Math.round(totalCents) / 100;
  }

  throw new ProviderVerificationError(
    "Polar returned more than 10,000 orders for this window. Choose a shorter reporting window.",
    422,
  );
}

async function verifyLemonSqueezyRevenue(
  apiKey: string,
  periodStart: string,
  periodEnd: string,
) {
  let totalCents = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL("https://api.lemonsqueezy.com/v1/orders");
    url.searchParams.set("page[number]", String(page));
    url.searchParams.set("page[size]", "100");
    const body = await providerJson(url, apiKey, "lemon_squeezy", {
      "Content-Type": "application/vnd.api+json",
    });
    if (!body) throw new ProviderVerificationError("Lemon Squeezy returned an empty response.", 502);

    const items = records(body.data);
    let reachedStart = false;
    for (const item of items) {
      const attributes = record(item.attributes);
      if (!attributes) continue;
      const createdAt = dateMillis(attributes.created_at, "lemon_squeezy");
      if (createdAt < new Date(periodStart).getTime()) {
        reachedStart = true;
        continue;
      }
      if (createdAt >= new Date(periodEnd).getTime() || attributes.test_mode === true) continue;
      if (!["paid", "partial_refund", "refunded"].includes(String(attributes.status))) continue;
      requireUsd(attributes.currency, "lemon_squeezy");
      const total = minorUnits(attributes.total_usd, "lemon_squeezy", "order total");
      const refunded = minorUnits(
        attributes.refunded_amount_usd ?? 0,
        "lemon_squeezy",
        "refunded",
      );
      totalCents += Math.max(0, total - refunded);
    }

    const pagination = record(record(body.meta)?.page);
    const lastPage = Number(pagination?.lastPage ?? pagination?.last_page ?? page);
    if (reachedStart || items.length < 100 || page >= lastPage) {
      return Math.round(totalCents) / 100;
    }
  }

  throw new ProviderVerificationError(
    "Lemon Squeezy returned more than 10,000 recent orders. Choose a shorter reporting window.",
    422,
  );
}

async function verifyPaddleRevenue(
  apiKey: string,
  periodStart: string,
  periodEnd: string,
) {
  let totalCents = 0;
  let nextUrl: URL | null = new URL("https://api.paddle.com/transactions");
  nextUrl.searchParams.set("status", "completed");
  nextUrl.searchParams.set("billed_at[GTE]", periodStart);
  nextUrl.searchParams.set("billed_at[LT]", periodEnd);
  nextUrl.searchParams.set("include", "adjustments_totals");
  nextUrl.searchParams.set("per_page", "30");

  for (let page = 0; page < MAX_PAGES && nextUrl; page += 1) {
    const body = await providerJson(nextUrl, apiKey, "paddle", {
      "Paddle-Version": "1",
    });
    if (!body) throw new ProviderVerificationError("Paddle returned an empty response.", 502);

    for (const transaction of records(body.data)) {
      if (transaction.status !== "completed") continue;
      if (!inWindow(transaction.billed_at, periodStart, periodEnd, "paddle")) continue;
      requireUsd(transaction.currency_code, "paddle");
      const details = record(transaction.details);
      const adjustedTotals = record(details?.adjusted_totals);
      const totals = adjustedTotals ?? record(details?.totals);
      if (!totals) {
        throw new ProviderVerificationError("Paddle returned a transaction without totals.", 502);
      }
      const amount = minorUnits(
        totals.grand_total ?? totals.total,
        "paddle",
        "adjusted transaction total",
      );
      totalCents += Math.max(0, amount);
    }

    const pagination = record(record(body.meta)?.pagination);
    if (pagination?.has_more !== true) return Math.round(totalCents) / 100;
    if (typeof pagination.next !== "string") {
      throw new ProviderVerificationError("Paddle did not return the next page cursor.", 502);
    }
    const candidate = new URL(pagination.next);
    if (candidate.origin !== "https://api.paddle.com" || candidate.pathname !== "/transactions") {
      throw new ProviderVerificationError("Paddle returned an invalid pagination URL.", 502);
    }
    nextUrl = candidate;
  }

  throw new ProviderVerificationError(
    "Paddle returned more than 3,000 transactions for this window. Choose a shorter reporting window.",
    422,
  );
}

async function getDodoPayments(
  apiKey: string,
  periodStart: string,
  periodEnd: string,
) {
  const payments = new Map<string, number>();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL("https://live.dodopayments.com/payments");
    url.searchParams.set("created_at_gte", periodStart);
    url.searchParams.set("created_at_lte", periodEnd);
    url.searchParams.set("status", "succeeded");
    url.searchParams.set("page_size", "100");
    url.searchParams.set("page_number", String(page));
    const body = await providerJson(url, apiKey, "dodo_payments");
    if (!body) throw new ProviderVerificationError("Dodo Payments returned an empty response.", 502);

    const items = records(body.items);
    for (const payment of items) {
      if (payment.status !== "succeeded") continue;
      if (!inWindow(payment.created_at, periodStart, periodEnd, "dodo_payments")) continue;
      requireUsd(payment.currency, "dodo_payments");
      if (typeof payment.payment_id !== "string") {
        throw new ProviderVerificationError("Dodo Payments returned a payment without an ID.", 502);
      }
      payments.set(
        payment.payment_id,
        Math.max(0, minorUnits(payment.total_amount, "dodo_payments", "payment total")),
      );
    }

    if (items.length < 100) return payments;
  }

  throw new ProviderVerificationError(
    "Dodo Payments returned more than 10,000 payments for this window. Choose a shorter reporting window.",
    422,
  );
}

async function verifyDodoRevenue(
  apiKey: string,
  periodStart: string,
  periodEnd: string,
) {
  const payments = await getDodoPayments(apiKey, periodStart, periodEnd);
  if (!payments.size) return 0;
  const refunds = new Map<string, number>();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL("https://live.dodopayments.com/refunds");
    url.searchParams.set("created_at_lte", periodEnd);
    url.searchParams.set("status", "succeeded");
    url.searchParams.set("page_size", "100");
    url.searchParams.set("page_number", String(page));
    const body = await providerJson(url, apiKey, "dodo_payments");
    if (!body) throw new ProviderVerificationError("Dodo Payments returned an empty response.", 502);

    const items = records(body.items);
    for (const refund of items) {
      if (refund.status !== "succeeded" || typeof refund.payment_id !== "string") continue;
      if (!payments.has(refund.payment_id)) continue;
      if (refund.currency != null) requireUsd(refund.currency, "dodo_payments");
      const amount = minorUnits(refund.amount, "dodo_payments", "refund");
      refunds.set(refund.payment_id, (refunds.get(refund.payment_id) ?? 0) + amount);
    }

    if (items.length < 100) {
      let totalCents = 0;
      for (const [paymentId, total] of payments) {
        totalCents += Math.max(0, total - (refunds.get(paymentId) ?? 0));
      }
      return Math.round(totalCents) / 100;
    }
  }

  throw new ProviderVerificationError(
    "Dodo Payments returned more than 10,000 refunds. Contact TokenGod before verifying this account.",
    422,
  );
}

function isoDate(value: string) {
  return value.slice(0, 10);
}

async function verifyEasytoolsRevenue(
  apiKey: string,
  periodStart: string,
  periodEnd: string,
) {
  let totalCents = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL("https://cart.easy.tools/api/v1/transactions");
    url.searchParams.set("paid_from", isoDate(periodStart));
    url.searchParams.set("paid_to", isoDate(periodEnd));
    url.searchParams.set("sort", "-date");
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "100");
    const body = await providerJson(url, apiKey, "easytools");
    if (!body) throw new ProviderVerificationError("Easytools returned an empty response.", 502);

    const items = records(body.items);
    for (const transaction of items) {
      if (!inWindow(transaction.date, periodStart, periodEnd, "easytools")) continue;
      requireUsd(transaction.currency, "easytools");
      const total = minorUnits(transaction.total, "easytools", "transaction total");
      const refunded = minorUnits(
        transaction.refunded_amount ?? 0,
        "easytools",
        "refunded",
      );
      totalCents += Math.max(0, total - refunded);
    }

    const pagination = record(body.pagination);
    const totalPages = Number(pagination?.total_pages ?? page);
    if (!Number.isFinite(totalPages) || totalPages < 1) {
      throw new ProviderVerificationError("Easytools returned invalid pagination data.", 502);
    }
    if (page >= totalPages) return Math.round(totalCents) / 100;
  }

  throw new ProviderVerificationError(
    "Easytools returned more than 10,000 transactions for this window. Choose a shorter reporting window.",
    422,
  );
}

export async function verifyRevenue(
  provider: RevenueProvider,
  apiKey: string,
  periodStart: string,
  periodEnd: string,
) {
  switch (provider) {
    case "stripe":
      return verifyStripeRevenue(apiKey, periodStart, periodEnd);
    case "polar":
      return verifyPolarRevenue(apiKey, periodStart, periodEnd);
    case "lemon_squeezy":
      return verifyLemonSqueezyRevenue(apiKey, periodStart, periodEnd);
    case "paddle":
      return verifyPaddleRevenue(apiKey, periodStart, periodEnd);
    case "dodo_payments":
      return verifyDodoRevenue(apiKey, periodStart, periodEnd);
    case "easytools":
      return verifyEasytoolsRevenue(apiKey, periodStart, periodEnd);
  }
}
