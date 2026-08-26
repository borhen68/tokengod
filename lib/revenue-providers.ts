export const revenueProviders = [
  {
    id: "stripe",
    name: "Stripe",
    color: "#635bff",
    tint: "#eeecff",
    credentialLabel: "Live restricted key",
    placeholder: "rk_live_••••••••••••",
    instructions: "Create a live restricted key with Charges set to Read. We total captured charges minus refunds.",
    docsUrl: "https://dashboard.stripe.com/apikeys/create",
    docsLabel: "Create restricted key",
  },
  {
    id: "polar",
    name: "Polar",
    color: "#14181d",
    tint: "#eff1f2",
    credentialLabel: "Organization access token",
    placeholder: "polar_oat_••••••••••••",
    instructions: "Create an organization access token with orders:read. We total paid orders minus refunded amounts.",
    docsUrl: "https://polar.sh/docs/integrate/authentication",
    docsLabel: "Create access token",
  },
  {
    id: "lemon_squeezy",
    name: "Lemon Squeezy",
    color: "#f59e0b",
    tint: "#fff5d9",
    credentialLabel: "API key",
    placeholder: "Lemon Squeezy API key",
    instructions: "Use a live API key. We read paid orders and subtract full or partial refunds.",
    docsUrl: "https://app.lemonsqueezy.com/settings/api",
    docsLabel: "Create API key",
  },
  {
    id: "paddle",
    name: "Paddle",
    color: "#111111",
    tint: "#f0f0ed",
    credentialLabel: "Live API key",
    placeholder: "pdl_live_apikey_••••••••",
    instructions: "Create a live API key with Transaction read access. We use completed transaction totals after adjustments.",
    docsUrl: "https://developer.paddle.com/api-reference/about/authentication",
    docsLabel: "API key guide",
  },
  {
    id: "dodo_payments",
    name: "Dodo Payments",
    color: "#ed6534",
    tint: "#fff0e9",
    credentialLabel: "Read-only live API key",
    placeholder: "Dodo Payments API key",
    instructions: "Create a live API key with write access disabled. We total succeeded payments minus succeeded refunds.",
    docsUrl: "https://docs.dodopayments.com/api-reference/introduction",
    docsLabel: "Create read-only key",
  },
  {
    id: "easytools",
    name: "Easytools",
    color: "#08a99b",
    tint: "#e8fbf8",
    credentialLabel: "Easycart API token",
    placeholder: "Easytools API token",
    instructions: "Use your Easycart API token. We total captured transactions minus their refunded amounts.",
    docsUrl: "https://developers.easy.tools/easycart/getting-started/authorization",
    docsLabel: "API token guide",
  },
] as const;

export type RevenueProvider = (typeof revenueProviders)[number]["id"];

export const revenueProviderIds = revenueProviders.map(
  (provider) => provider.id,
) as [RevenueProvider, ...RevenueProvider[]];

export function getRevenueProvider(provider: RevenueProvider) {
  return revenueProviders.find((candidate) => candidate.id === provider)!;
}

export function isRevenueProvider(value: unknown): value is RevenueProvider {
  return revenueProviderIds.includes(value as RevenueProvider);
}
