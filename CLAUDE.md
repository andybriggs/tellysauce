# TellySauce — Project Context

## What this app is
A Next.js 15 web app for discovering, rating, and getting AI-powered recommendations for TV shows and movies. Hosted on Vercel. Users can search titles, maintain a watchlist, rate shows 1–5, and receive personalised AI recommendations.

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
- **AI**: OpenAI (`openai`) — `src/lib/ai.ts` (shared client), `src/app/api/recommend/route.ts`, `src/app/api/cron/ai-popular/route.ts`
- **Payments**: Stripe (subscriptions) — `src/lib/stripe.ts`
- **Data fetching**: SWR (client-side), Next.js fetch with ISR (server-side)
- **Styling**: TailwindCSS, Embla Carousel
- **Deployment**: Vercel (includes cron jobs via `vercel.json`)

## Database schema (`src/db/schema.ts`)
- `users` — Google OAuth users + Stripe subscription fields (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_period_end`, `free_rec_calls_used`)
- `titles` — TMDB title cache (tmdbId + mediaType unique)
- `user_titles` — watchlist and ratings (status: WATCHLIST | RATED, rating 1–5)
- `recommendation_sets` / `recommendation_items` — AI recommendation cache (7-day expiry)
- `ai_popular_titles` — daily AI-curated popular titles from Reddit/online buzz (populated by cron)

## Key environment variables (`.env.local`)
- `TMDB_ACCESS_TOKEN` — TMDB v4 Bearer token
- `OPENAI_API_KEY` — OpenAI API key (used for recommendations and cron web search)
- `DATABASE_URL` / `DATABASE_URL_UNPOOLED` — Neon PostgreSQL
- `CRON_SECRET` — Bearer token for Vercel cron auth
- `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY` — Stripe secret key (`sk_test_...` locally, `sk_live_...` on Vercel)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret. **Local dev**: use the `whsec_...` printed by `stripe listen` (different from the dashboard secret). **Vercel**: use the secret from the dashboard webhook endpoint.
- `STRIPE_PRICE_ID` — Stripe Price ID (`price_...`) for the £1.99/month TellySauce Pro plan
- `OMDB_API_KEY` — OMDb API key for IMDb ratings on the title detail page. Free (1,000 req/day) from omdbapi.com. If absent, rating buttons gracefully show "Rating unavailable".

## Important patterns

### OpenAI usage
All AI calls use the shared client from `src/lib/ai.ts` (`openai` instance, `openai` npm package).

**Recommendations** (`src/app/api/recommend/route.ts`) — single `gpt-4o-mini` call per request:
- `openai.chat.completions.create` with `response_format: { type: "json_schema", ... }` (strict structured output)
- Returns `{ recommendations: [{ title, description, reason, tags, year }] }` directly — no intermediate text parsing
- Seed mode: 3 recommendations based on a single title. Profile mode: 8 based on the user's rated watchlist.

**Cron** (`src/app/api/cron/ai-popular/route.ts`) — 4-stage pipeline:
1. **Stage 1** — web search: `openai.responses.create` with model `gpt-4o-mini-search-preview` + `web_search_preview` tool. Returns pipe-delimited text of trending titles from Reddit.
2. **Stage 2** — JSON structuring: `gpt-4o-mini` chat completions with `json_schema`. Parses the Stage 1 text into structured `{ titles: [...] }`.
3. **Stage 3** — TMDB resolution: fetches poster/description from TMDB for each title.
4. **Stage 3.5** — quote generation: `gpt-4o-mini` chat completions with `json_schema`. Generates Reddit-style viewer quotes per title.

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
- The title detail page fetches `vote_average` / `vote_count` from the base TMDB endpoint (already included; no extra append needed) and stores them as `tmdb_vote_average` / `tmdb_vote_count` on `TitleDetails`

### Watch providers (Where to watch)
- `fetchTitleSources(kind, id, revalidate)` — `src/server/tmdb.ts` — returns `Record<string, TitleSource[]>` keyed by ISO country code (e.g. `"GB"`, `"US"`). TMDB returns all regions in one call; we return them all.
- `src/components/WhereToWatch.tsx` — client component. Reads selected region from `localStorage` key `"watch_region"`, falling back to country derived from `navigator.language`, then `"GB"`. Shows a dropdown listing only countries that have provider data for the current title. Priority order: GB, US, CA, AU, IE, then alphabetical.

### OMDb API (IMDb ratings)
- `fetchIMDbRating(imdbId)` in `src/app/title/[kind]/[id]/page.tsx` — server-side fetch to `https://www.omdbapi.com/?i={imdbId}&apikey={OMDB_API_KEY}`
- Returns the `imdbRating` string (e.g. `"8.9"`) or `null` when unavailable or key is absent
- Cached via Next.js ISR (`next: { revalidate }`) — same 1-hour window as the TMDB fetch
- Result is passed to `ExternalLinks` as `imdbRating`; the component shows "Rating unavailable" when null

### API routes
| Route | Purpose |
|-------|---------|
| `GET /api/discover?type=movie|tv&timeframe=recent|all` | TMDB popular/top-rated |
| `GET /api/discover?type=movie|tv&source=ai` | AI picks from `ai_popular_titles` DB table |
| `POST /api/recommend` | AI recommendations via OpenAI (profile or seed mode) — subscription-gated |
| `GET /api/cron/ai-popular` | Daily cron: OpenAI web search → TMDB → `ai_popular_titles` |
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
- Resolves AI-returned title strings to TMDB IDs, enriches with poster/description, stores in `ai_popular_titles`
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
- `src/components/recommendations/` — AI recommendation display components

## Known architectural note
`page.tsx` is a client component (`"use client"`), so the AI picks are currently fetched client-side via SWR despite the data coming from our own DB. Server rendering the AI picks would require extracting the interactive search parts into separate client components — a worthwhile but separate refactor.

## Coding conventions
- Raw SQL via `db.execute(sql\`...\`)` for complex queries; Drizzle ORM for schema definition
- `mediaTypeEnum` ("tv" | "movie") is a shared pgEnum — reuse it for any new table with a media type column
- API routes that talk to the DB should handle the case where a table is empty/missing and return `{ titles: [] }` rather than 500
- No new components for single-use UI — extend existing ones with props where the addition is small
