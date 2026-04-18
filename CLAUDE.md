# TellySauce — Project Context

## What this app is
A Next.js 15 web app for discovering, rating, and getting AI-powered recommendations for TV shows and movies. Hosted on Vercel. Users can search titles, maintain a watchlist, rate shows 1–5, and receive personalised Gemini AI recommendations.

## Package manager
Always use **yarn** (not npm). `package.json` has `"packageManager": "yarn@1.22.22"`. Run `yarn install`, `yarn dev`, `yarn test`, etc. Never commit a `package-lock.json`.

## Testing
- **Stack**: Vitest + React Testing Library + MSW
- **Run**: `yarn test` (watch) or `yarn test --run` (CI)
- **Coverage**: `yarn test:coverage`
- Test files sit next to source (`*.test.ts` / `*.test.tsx`). Setup: `src/test/setup.ts`. MSW handlers: `src/test/mocks/handlers.ts`.

## Tech stack
- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Database**: PostgreSQL via Neon (serverless), Drizzle ORM — `src/db/schema.ts`
- **Auth**: NextAuth.js v4, Google OAuth — `src/lib/auth.ts`
- **AI**: Google Gemini (`@google/genai`) — `src/app/api/recommend/route.ts`
- **Payments**: Stripe (subscriptions) — `src/lib/stripe.ts`
- **Data fetching**: SWR (client-side), Next.js fetch with ISR (server-side)
- **Styling**: TailwindCSS, Embla Carousel
- **Deployment**: Vercel (includes cron jobs via `vercel.json`)

## Database schema (`src/db/schema.ts`)
- `users` — Google OAuth users + Stripe subscription fields (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_period_end`, `free_rec_calls_used`)
- `titles` — TMDB title cache (tmdbId + mediaType unique)
- `user_titles` — watchlist and ratings (status: WATCHLIST | RATED, rating 1–5)
- `recommendation_sets` / `recommendation_items` — Gemini recommendation cache (7-day expiry)
- `ai_popular_titles` — daily AI-curated popular titles from Reddit/online buzz (populated by cron)

## Key environment variables (`.env.local`)
- `TMDB_ACCESS_TOKEN` — TMDB v4 Bearer token
- `GOOGLE_GEMINI_API_KEY` — Gemini API key
- `GEMINI_MODEL_GROUNDED` — grounded search model (default: `gemini-2.5-flash`)
- `GEMINI_MODEL_STRUCT` — JSON structuring model (default: `gemini-2.5-flash-lite`)
- `DATABASE_URL` / `DATABASE_URL_UNPOOLED` — Neon PostgreSQL
- `CRON_SECRET` — Bearer token for Vercel cron auth
- `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY` — Stripe secret key (`sk_test_...` locally, `sk_live_...` on Vercel)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret. **Local dev**: use the `whsec_...` printed by `stripe listen` (different from the dashboard secret). **Vercel**: use the secret from the dashboard webhook endpoint.
- `STRIPE_PRICE_ID` — Stripe Price ID (`price_...`) for the £1.99/month TellySauce Pro plan

## Important patterns

### Gemini usage (2-stage pipeline)
All Gemini calls follow this pattern from `src/app/api/recommend/route.ts`:
1. **Stage 1** — grounded text generation: `GEMINI_MODEL_GROUNDED` + `tools: [{ googleSearch: {} }]` + `stopSequences: ["<<<END>>>"]`
2. **Stage 2** — JSON structuring: `GEMINI_MODEL_STRUCT` + `responseMimeType: "application/json"` + `responseSchema`
Helper functions `extractModelText`, `parseLines`, `parseJsonArrayOfRecs` are defined in `recommend/route.ts` and copied into the cron route.

### DB migrations
The project uses both `drizzle-kit push` (dev) and hand-written SQL files in `drizzle/`. To apply a new migration manually:
```js
// Run SQL statements sequentially via @neondatabase/serverless
const sql = neon(process.env.DATABASE_URL_UNPOOLED);
await sql.query(`CREATE TABLE IF NOT EXISTS ...`);
```
`db:push` can get interrupted by existing constraint prompts — run SQL directly when that happens.

### TMDB resolution
- `fetchTMDBTitle(tmdbId, mediaType)` — `src/server/tmdb.ts` — fetches full title details
- TMDB search year params differ by type: movies use `year`, TV shows use `first_air_date_year`

### API routes
| Route | Purpose |
|-------|---------|
| `GET /api/discover?type=movie|tv&timeframe=recent|all` | TMDB popular/top-rated |
| `GET /api/discover?type=movie|tv&source=ai` | AI picks from `ai_popular_titles` DB table |
| `POST /api/recommend` | Gemini recommendations (profile or seed mode) — subscription-gated |
| `GET /api/cron/ai-popular` | Daily cron: Gemini → TMDB → `ai_popular_titles` |
| `GET /api/autocomplete` | TMDB title search |
| `GET /api/resolve-title` | Advanced TMDB title resolution with scoring |
| `GET /api/subscription-status` | Returns `{ subscriptionStatus, freeRecCallsUsed }` for the current user |
| `POST /api/stripe/checkout` | Creates a Stripe Checkout session → returns `{ url }` |
| `POST /api/stripe/portal` | Creates a Stripe Billing Portal session → returns `{ url }` |
| `POST /api/stripe/webhook` | Stripe webhook handler (subscription lifecycle + payment failure) |

### Cron job (`src/app/api/cron/ai-popular/route.ts`)
- Runs daily at 06:00 UTC (configured in `vercel.json`)
- Auth: `Authorization: Bearer $CRON_SECRET` header (Vercel adds this automatically)
- Fetches top 10 movies + top 10 TV shows being positively discussed in Western/mainstream online communities (Reddit etc.)
- **Regional focus**: English-speaking countries (US, UK, AU, CA, IE) + Western Europe. East Asian content only if major Western crossover (e.g. Squid Game).
- Resolves Gemini-returned title strings to TMDB IDs, enriches with poster/description, stores in `ai_popular_titles`
- Guard: skips DB write if 0 titles resolved (preserves previous day's data)

### Stripe subscription paywall
- **Plan**: TellySauce Pro, £1.99/month (monthly only), GBP
- **Gated features**: `POST /api/recommend` (both profile and seed mode). Daily AI picks are free.
- **Free tier**: 3 lifetime recommendation generations per user (tracked via `free_rec_calls_used` on `users`). Counter only increments on fresh generation, not on cache reads (`GET /api/recommendations`).
- **Gate logic** (`src/app/api/recommend/route.ts`): checks `subscription_status = 'active'` OR `free_rec_calls_used < 3`. Returns HTTP 402 with `{ error: 'subscription_required' }` if blocked.
- **Paywall UI** (`src/components/PaywallModal.tsx`): modal shown when client receives 402, handled in `RecommendTitles.tsx`.
- **Stripe client**: `src/lib/stripe.ts` — singleton used by all Stripe API routes.
- **Webhook events handled**: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- **Local dev webhook**: run `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Use the `whsec_...` it prints as `STRIPE_WEBHOOK_SECRET` — this is different from the dashboard secret.
- **Billing portal**: subscribers can manage/cancel via Stripe hosted portal (`POST /api/stripe/portal`). Accessible via the "Pro · Manage" button shown to subscribed users in the header.

## Frontend structure
- `src/app/page.tsx` — homepage (`"use client"` — uses search hooks). AI picks render first, then TMDB popular sections below.
- `src/components/PopularTitles.tsx` — handles both TMDB and AI picks via `source` prop. `source="ai"` hides the timeframe tabs and shows a different title.
- `src/hooks/useDiscoverTitles.ts` — SWR hook, accepts `{ timeframe?, source? }` options
- `src/components/recommendations/` — Gemini recommendation display components

## Known architectural note
`page.tsx` is a client component (`"use client"`), so the AI picks are currently fetched client-side via SWR despite the data coming from our own DB. Server rendering the AI picks would require extracting the interactive search parts into separate client components — a worthwhile but separate refactor.

## Coding conventions
- Raw SQL via `db.execute(sql\`...\`)` for complex queries; Drizzle ORM for schema definition
- `mediaTypeEnum` ("tv" | "movie") is a shared pgEnum — reuse it for any new table with a media type column
- API routes that talk to the DB should handle the case where a table is empty/missing and return `{ titles: [] }` rather than 500
- No new components for single-use UI — extend existing ones with props where the addition is small
