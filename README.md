# TokenGod

TokenGod is a transparent AI-spend efficiency leaderboard for founders. Every live listing combines a self-listed X handle, clearly labeled AI spend and revenue, and public reactions.

## What is implemented

- Two rankings from one listing pool: **Most Respected** (Love, then higher efficiency) and **Most Roasted** (Laugh, then lower efficiency)
- Frictionless listing attribution with an X handle—no login required to submit
- Best-effort public X profile enrichment for the founder display name and avatar
- Frictionless reactions backed by a signed, httpOnly browser identity cookie
- Two honest AI-spend paths: organization API verification or clearly labeled founder-reported personal/subscription spend
- OpenAI and Anthropic organization-cost verification for founders who can safely use Admin API keys
- Stripe live revenue verification using captured USD charges minus refunds
- Signed 30-minute verification receipts that can be claimed only once
- Turso schema constraints for one Love and one Laugh per browser identity per listing
- Transactional reaction rate limiting at 20 actions per minute
- Dynamic, downloadable 1200×630 cards and listing-specific social metadata
- A $3 Stripe Checkout entry fee that includes up to 3 sites, then $1 per additional site
- One founder profile, one verified efficiency score, and one leaderboard position across every submitted site
- An explicitly sponsored **Surface 3** where optional boost dollars—not added-site fees—raise a build
- Stripe webhook and success-return finalization with idempotent paid-entry and backing records
- Stripe metadata isolation: TokenGod ignores checkout events created by other apps sharing the account
- DataFast pageviews, funnel goals, and Stripe visitor/session attribution for TokenGod only
- Product URL auto-fill for editable name, description, and logo metadata
- A responsive flood-tank visual metaphor; it is explicitly not a physical water-use estimate

## Local setup

Use Node.js 20.9 or newer.

```bash
npm ci
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Then open `http://localhost:3000`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public origin used for callbacks, metadata, and share links. No trailing slash. |
| `NEXT_PUBLIC_DATAFAST_WEBSITE_ID` | Optional public override for TokenGod's DataFast website ID. |
| `NEXT_PUBLIC_DATAFAST_DOMAIN` | Optional public override for the tracked domain; defaults to `tokengod.lol`. |
| `TURSO_DATABASE_URL` | Turso `libsql://` database URL. |
| `TURSO_AUTH_TOKEN` | Server-only Turso token with read/write access. |
| `X_CLIENT_ID` | Optional X OAuth 2.0 client ID for account sessions; reactions do not require it. |
| `X_CLIENT_SECRET` | Optional X OAuth 2.0 client secret for account sessions; reactions do not require it. |
| `X_BEARER_TOKEN` | Optional app bearer token for reliable public founder-profile lookup; the public X page is used as a fallback. |
| `SESSION_SECRET` | Random secret for login and anonymous reaction cookies. Falls back to `VERIFICATION_RECEIPT_SECRET` for reactions. |
| `VERIFICATION_RECEIPT_SECRET` | Separate random secret of at least 32 characters. |
| `STRIPE_SECRET_KEY` | Server-only key for TokenGod's own Stripe account; charges entry and Surface backing payments. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the Stripe webhook endpoint. |

Generate the two signing secrets separately:

```bash
openssl rand -hex 32
```

Do not commit `.env.local`; all `.env*` files except `.env.example` are ignored.

## X OAuth configuration

Create an OAuth 2.0 application in the X developer portal and configure it as a confidential web app. It only needs `tweet.read users.read`; TokenGod never posts on a user's behalf.

Add these exact callback URLs:

- Local: `http://localhost:3000/auth/callback`
- Production: `https://YOUR_DOMAIN/auth/callback`

Set `NEXT_PUBLIC_SITE_URL` to the matching origin in each environment.

## Verification credentials

The submission flow sends each credential once to the relevant provider, stores only the aggregate result, clears the browser field after success, and never writes provider credentials to Turso.

- **OpenAI:** an organization Admin API key (`sk-admin-…`). TokenGod reads `GET /v1/organization/costs` for the last 90 completed UTC days.
- **Anthropic:** an organization Admin API key (`sk-ant-admin…`). TokenGod reads `GET /v1/organizations/cost_report`, includes only token costs, and converts Anthropic's reported USD cents to dollars.
- **Stripe:** a live restricted key (`rk_live_…`) with **Charges: Read** only. TokenGod totals captured USD charges minus refunds in the same window. Multi-currency accounts are rejected in v1 instead of applying an invented exchange rate.

Stripe revenue must verify for the 90-day window before publishing. AI spend can either be pulled from the provider for the same window or entered by a personal-plan user as founder-reported spend. The verification source is stored and displayed on every leaderboard row, detail page, and share card; stronger proof wins exact reaction-count ties before efficiency is considered.

The initial founder profile is a one-time bootstrap exception: both of its numbers are visibly labeled founder-reported and it is excluded from the paid Surface 3. Every public submission still requires Stripe revenue verification and payment.

Anthropic individual accounts cannot use its Usage & Cost Admin API. Claude Console Admin keys also have broad organization access rather than a cost-only scope, so the UI discloses that risk and never presents the Admin-key route as required. OpenAI's organization cost endpoint likewise requires an Admin API key. Credentials are used for one request and are never written to Turso.

The X handle, product name, URL, and description are self-listed fields. A founder's restricted revenue key is never used to collect TokenGod's fee; payments use the separate platform Stripe key above.

## Paid entry, multiple sites, and Surface 3

Publishing costs $3 through hosted Stripe Checkout and includes up to 3 product sites under one founder profile. Site 4 and every additional site cost $1 each. All sites share the same Stripe-verified 90-day revenue, labeled AI spend, efficiency score, reaction totals, and leaderboard position.

The same checkout can include an optional whole-dollar Surface boost. Surface 3 is a visibly labeled sponsored board ranked only by the $3 entry plus explicit boost/backing dollars, with older entries winning exact-dollar ties. Additional-site fees are stored separately and never affect rank. Love and Roast remain earned rankings and are never affected by payment.

Anyone can back a visible Surface 3 build by $1 or more. Stripe Checkout redirects back through `/payment/complete`, while the webhook provides the durable production confirmation. Both paths call the same idempotent finalizer.

Create a Stripe webhook for:

```text
https://YOUR_DOMAIN/api/stripe/webhook
```

Subscribe it to `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then store its signing secret as `STRIPE_WEBHOOK_SECRET`.

## Database

Numbered schemas are in `turso/migrations/`. Apply every unapplied migration with:

```bash
npm run db:migrate
```

The migration is repeat-safe. Database constraints enforce reaction uniqueness and referential integrity; the API additionally uses signed browser identities, origin checks, receipt validation, and transactional rate limiting.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Deploying to Vercel

1. Import the repository into Vercel.
2. Add every production environment variable listed above.
3. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin.
4. Add that origin's `/auth/callback` URL to the X app.
5. Register the Stripe webhook endpoint and add its signing secret.
6. Apply the Turso migrations once, then deploy.

Rotate any database token that has ever been pasted into a chat or log before using the app in production.
