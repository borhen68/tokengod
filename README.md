# TokenGod

TokenGod is a verified AI-spend efficiency leaderboard for founders. Every live listing combines a self-listed X handle, provider-reported AI spend, Stripe revenue, and authenticated public reactions.

## What is implemented

- Two rankings from one listing pool: **Most Respected** (Love, then higher efficiency) and **Most Roasted** (Laugh, then lower efficiency)
- Frictionless listing attribution with an X handle—no login required to submit
- Best-effort public X profile enrichment for the founder display name and avatar
- X OAuth 2.0 with PKCE and signed, httpOnly session cookies for reactions
- OpenAI and Anthropic organization-cost verification
- Stripe live revenue verification using captured USD charges minus refunds
- Signed 30-minute verification receipts that can be claimed only once
- Turso schema constraints for one Love and one Laugh per X user per listing
- Transactional reaction rate limiting at 20 actions per minute
- Dynamic, downloadable 1200×630 cards and listing-specific social metadata
- A $3 Stripe Checkout entry fee plus an explicitly sponsored **Surface 3** where each extra $1 raises a build
- Stripe webhook and success-return finalization with idempotent paid-entry and backing records
- Stripe metadata isolation: TokenGod ignores checkout events created by other apps sharing the account
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
| `TURSO_DATABASE_URL` | Turso `libsql://` database URL. |
| `TURSO_AUTH_TOKEN` | Server-only Turso token with read/write access. |
| `X_CLIENT_ID` | Optional X OAuth 2.0 client ID for authenticated reactions. |
| `X_CLIENT_SECRET` | Optional X OAuth 2.0 client secret for authenticated reactions. |
| `X_BEARER_TOKEN` | Optional app bearer token for reliable public founder-profile lookup; the public X page is used as a fallback. |
| `SESSION_SECRET` | Random secret for login cookies when X OAuth is enabled. |
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

Both revenue and AI spend must verify for the identical window before publishing. The X handle, product name, URL, and description are self-listed fields. A founder's restricted revenue key is never used to collect TokenGod's fee; payments use the separate platform Stripe key above.

## Paid entry and Surface 3

Publishing costs exactly $3 through hosted Stripe Checkout. The same checkout can include an optional whole-dollar Surface boost. Surface 3 is a visibly labeled sponsored board ranked by total paid entry plus backing, with older entries winning exact-dollar ties. Love and Roast remain earned rankings and are never affected by payment.

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

The migration is repeat-safe. Database constraints enforce reaction uniqueness and referential integrity; the API additionally performs authentication, origin checks, receipt validation, and transactional rate limiting.

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
