# TellySauce - Project Context

## What this app is

A Next.js 15 web app for discovering, rating, and getting AI-powered recommendations for TV shows and movies. Hosted on Vercel. Users can search titles, maintain a watchlist, rate shows 1-5, and receive personalised AI recommendations.

## Package manager

Always use **yarn** (not npm). `package.json` has `"packageManager": "yarn@1.22.22"`. Run `yarn install`, `yarn dev`, `yarn test`, etc. Never commit a `package-lock.json`.

## Testing

- **Stack**: Vitest + React Testing Library + MSW
- **Run**: `yarn test` (watch) or `yarn test --run` (CI)
- **Coverage**: `yarn test:coverage`
- Test files sit next to source (`*.test.ts` / `*.test.tsx`). Setup: `src/test/setup.ts`. MSW handlers: `src/test/mocks/handlers.ts`.

## Tech stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Database**: PostgreSQL via Neon (serverless), Drizzle ORM - `src/db/schema.ts`
- **Auth**: NextAuth.js v4, Google OAuth - `src/lib/auth.ts`
- **AI**: OpenAI (`openai`) - `src/lib/ai.ts` (shared client), `src/app/api/recommend/route.ts`, `src/app/api/cron/ai-popular/route.ts`
- **Payments**: Stripe (subscriptions) - `src/lib/stripe.ts`
- **Data fetching**: SWR (client-side), Next.js fetch with ISR (server-side)
- **Styling**: TailwindCSS, Embla Carousel
- **Deployment**: Vercel (includes cron jobs via `vercel.json`)

## Database schema (`src/db/schema.ts`)

- `users` - Google OAuth users + Stripe subscription fields (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_period_end`, `free_rec_calls_used`)
- `titles` - shared TMDB title cache (unique on `tmdb_id + media_type`). Written by: title detail page views, cron job, and recommendation generation. Stores `poster`, `year`, `description`.
- `user_titles` - watchlist and ratings (status: WATCHLIST | RATED, rating 1-5)
- `recommendation_sets` - one row per user per cache key (profile or seed). `user_key` = `${userId}:${key}`, unique. 7-day expiry via `expires_at`.
- `recommendation_items` - individual recommendations within a set. `suggested_tmdb_id` and `suggested_media_type` are populated after TMDB validation; `raw_json` stores the full OpenAI response object.
- `ai_popular_titles` - daily AI-curated popular titles from Reddit/online buzz (populated by cron)
- `user_badges` - gamification awards, one row per `(user_id, badge_key)`. Unique via `user_badges_user_key_unique`. `seen` is false until the unlock modal has been shown. Awards are permanent.

## Key environment variables (`.env.local`)

- `TMDB_ACCESS_TOKEN` - TMDB v4 Bearer token
- `OPENAI_API_KEY` - OpenAI API key (used for recommendations and cron web search)
- `DATABASE_URL` / `DATABASE_URL_UNPOOLED` - Neon PostgreSQL
- `CRON_SECRET` - Bearer token for Vercel cron auth
- `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY` - Stripe secret key (`sk_test_...` locally, `sk_live_...` on Vercel)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret. **Local dev**: use the `whsec_...` printed by `stripe listen` (different from the dashboard secret). **Vercel**: use the secret from the dashboard webhook endpoint.
- `STRIPE_PRICE_ID` - Stripe Price ID (`price_...`) for the £1.99/month TellySauce Pro plan
- `AI_POPULAR_REGION` - ISO country code the AI picks cron grounds itself to (default `GB`). Drives `user_location` on the web search plus the services/sources named in the prompt.
- `OMDB_API_KEY` - OMDb API key for IMDb and Rotten Tomatoes ratings on the title detail page. Free (1,000 req/day) from omdbapi.com. If absent, both rating pills are hidden.

## Important patterns

### OpenAI usage

All AI calls use the shared client from `src/lib/ai.ts` (`openai` instance, `openai` npm package).

**Recommendations** (`src/app/api/recommend/route.ts`) - pipeline per request:

1. `openai.chat.completions.create` (`gpt-6-luna`, in `src/server/recommendations.ts`) with `response_format: { type: "json_schema", ... }` (strict structured output). Schema includes `mediaType: enum["movie","tv"]` on each item.
2. Parallel TMDB search per recommendation (`/search/movie` or `/search/tv`) - year-constrained first, then unconstrained fallback. Unresolvable titles are filtered out.
3. Each verified title is upserted into the shared `titles` table (`ON CONFLICT (tmdb_id, media_type) DO UPDATE`).
4. Results saved to `recommendation_items` with `suggested_tmdb_id` and `suggested_media_type` populated.
5. Response shape: `{ recommendations: [{ title, description, reason, tags, year, mediaType, resolvedTmdbId, poster }], key, setId }`.

- Seed mode: 3 recommendations. Profile mode: 8 (grouped by rating tier in prompt; dominant media type inferred and included).
- Cache read: `GET /api/recommendations?key=...` - joins `recommendation_items` with `titles` to return `poster`.
- Service functions (`callOpenAI`, `validateAndEnrich`, `upsertTitle`, `upsertRecommendationSet`, `replaceRecommendationItems`) live in `src/server/recommendations.ts` and are imported by the route. The `Rec` type is exported from there too.

**Cron** (`src/app/api/cron/ai-popular/route.ts`) - 2-stage pipeline:

1. **Stage 1** - grounded web search + JSON structuring in a **single** `openai.responses.create` call: model `gpt-6-luna`, the modern `web_search` tool (`search_context_size: "high"`, `user_location` from `AI_POPULAR_REGION`), and a strict `json_schema` output. Runs once per media type, **sequentially** - a high-context search is ~70-80k tokens against a 200k TPM limit, so firing movie and TV in parallel risks a 429 taking out the whole run. Retries up to 3 times, with backoff on 429 specifically.
2. **Stage 2** - TMDB resolution: `searchTmdbByTitle` per title, in batches of 5, then poster/description enrichment.

The prompt **must** state today's date. Without a date anchor the model answers from its training distribution, which is how the carousels previously ended up showing titles that were popular at the model's training cutoff rather than now. The schema also requires a `lastAired` date per title as checkable evidence for the recency rule.

**Dead code to be aware of**: the Reddit quote feature is wired end to end (the `reddit_quotes` jsonb column, the `RedditQuote` type, the `fetchAiPopularData` read helper and the `RedditQuotes` UI component all exist) but Stage 1 hardcodes `quotes: []`, so the column is always written as `NULL`. Nothing renders.

### Region handling

Region is a single shared setting, not a per-component constant. `src/lib/region.ts` owns it:

- `WATCH_REGION_KEY` is the **existing** `"watch_region"` localStorage key, so a region chosen on a title page and one chosen in the header are the same choice.
- `detectRegion()` - localStorage, then the `navigator.language` country suffix, then `DEFAULT_REGION` (`"GB"`).
- `regionOriginCountries(code)` - the TMDB `with_origin_country` group for a region (`GB -> ["GB","IE"]`, `AU -> ["AU","NZ"]`, `US -> ["US","CA"]`). Neighbouring markets are grouped so co-productions are not missed. Unknown codes fall back to the GB group.
- `regionLabel(code)` - via `Intl.DisplayNames`.

`RegionProvider` (`src/components/common/RegionProvider.tsx`) is mounted in `providers.tsx`. `useRegion()` returns `{ region, setRegion }` where **`region` is `null` until the client has read localStorage** - consumers must not fetch while it is null, or they fire a throwaway request for the wrong region and risk a hydration mismatch. `useDiscoverTitles` handles this by returning a null SWR key. The context default is a working non-null value so components render fine outside the provider (component tests rely on this).

Consumers: `RegionPicker` in the header, the region-scoped carousel, `WhereToWatch`, and the `region` field on the `POST /api/recommend` body.

**Caveat**: the picker does **not** change the AI picks carousels. The cron has no user and grounds to `AI_POPULAR_REGION`. Per-region AI picks would need a `region` column on `ai_popular_titles` (it has none) and one cron run per region.

### TMDB discover query shapes

`src/lib/discover.ts` holds the constants and post-filters for the discover carousels. These exist for a specific reason: TMDB's `popularity` metric rewards steady page traffic, so an **unfiltered `popularity.desc` on `/discover/tv` returns daily-airing talk shows and soaps** - the carousel used to open with Watch What Happens Live, The Tonight Show and Law & Order: SVU.

- `EXCLUDED_TV_GENRES` - news, reality, talk, soap, kids (`without_genres`).
- `dropEvergreenSeries()` - drops shows whose `first_air_date` is more than `EVERGREEN_MAX_AGE_YEARS` (6) old. TMDB has no parameter for "not a decades-old continuing series", so this runs after the fetch. **This is the filter that separates Slow Horses (2022) from Coronation Street (1960)**, so do not remove it. Note `Number("")` is `0`, not `NaN` - the emptiness check must come before the numeric one.
- Any query that gets post-filtered fetches 2 pages (`mergePages`) so a full carousel survives.
- All-time lists need an upper date bound (`primary_release_date.lte` / `first_air_date.lte`) and a high `vote_count.gte`, otherwise barely-released titles with inflated averages outrank the classics.
- The regional treatment is **TV-only** - recent GB/IE film releases are mostly obscure indies.

### DB migrations

The project uses both `drizzle-kit push` (dev) and hand-written SQL files in `drizzle/`. To apply a new migration manually:

```js
// Run SQL statements sequentially via @neondatabase/serverless
const sql = neon(process.env.DATABASE_URL_UNPOOLED);
await sql.query(`CREATE TABLE IF NOT EXISTS ...`);
```

`db:push` can get interrupted by existing constraint prompts - run SQL directly when that happens.

### TMDB resolution

- `fetchTMDBTitle(tmdbId, mediaType)` - `src/server/tmdb.ts` - fetches full title details
- TMDB search year params differ by type: movies use `year`, TV shows use `first_air_date_year`
- The title detail page fetches `vote_average` / `vote_count` from the base TMDB endpoint (already included; no extra append needed) and stores them as `tmdb_vote_average` / `tmdb_vote_count` on `TitleDetails`

### Watch providers (Where to watch)

- `fetchTitleSources(kind, id, revalidate)` - `src/server/tmdb.ts` - returns `Record<string, TitleSource[]>` keyed by ISO country code (e.g. `"GB"`, `"US"`). TMDB returns all regions in one call; we return them all.
- `src/components/title/WhereToWatch.tsx` - client component. Reads selected region from `localStorage` key `"watch_region"`, falling back to country derived from `navigator.language`, then `"GB"`. Shows a dropdown listing only countries that have provider data for the current title. Priority order: GB, US, CA, AU, IE, then alphabetical.

### OMDb API (IMDb + Rotten Tomatoes ratings)

- `fetchIMDbRating(imdbId)` in `src/server/omdb.ts` - server-side fetch to `https://www.omdbapi.com/?i={imdbId}&apikey={OMDB_API_KEY}`
- Returns `{ imdbRating: string | null, rtRating: string | null }` - `imdbRating` from the top-level field (e.g. `"8.9"`), `rtRating` from the `Ratings` array entry where `Source === "Rotten Tomatoes"` (e.g. `"92%"`)
- Cached via Next.js ISR (`next: { revalidate }`) - same 1-hour window as the TMDB fetch
- Results passed to `ExternalLinks` as `imdbRating` / `rtRating`; IMDb pill shows "Rating unavailable" when null, RT pill is omitted entirely when null
- TMDB rating is no longer displayed on the title page

### API routes

| Route                                                    | Purpose                                                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /api/discover?type=movie\|tv&timeframe=recent\|all` | TMDB popular/top-rated                                                                          |
| `GET /api/discover?type=movie\|tv&source=ai`             | AI picks from `ai_popular_titles` DB table                                                      |
| `GET /api/discover?type=tv&source=regional&region=GB`     | Region-scoped TV currently airing in that market (TV only; 400 for `type=movie`)                |
| `POST /api/recommend`                                    | AI → TMDB validation → upsert `titles` → save items (profile or seed mode) - subscription-gated |
| `GET /api/recommendations?key=...`                       | Cached recommendation items, joined with `titles` for poster data                               |
| `GET /api/cron/ai-popular`                               | Daily cron: OpenAI web search → TMDB → `ai_popular_titles`                                      |
| `GET /api/badges`                                        | Evaluates all categories, then returns `{ badges, progress }`                                   |
| `POST /api/badges`                                       | Marks badge keys as seen (`{ keys: string[] }`)                                                 |
| `GET /api/autocomplete`                                  | TMDB title search                                                                               |
| `GET /api/resolve-title`                                 | Advanced TMDB title resolution with scoring (used by `/open/title` page)                        |
| `GET /api/subscription-status`                           | Returns `{ subscriptionStatus, freeRecCallsUsed }` for the current user                         |
| `POST /api/stripe/checkout`                              | Creates a Stripe Checkout session → returns `{ url }`                                           |
| `POST /api/stripe/portal`                                | Creates a Stripe Billing Portal session → returns `{ url }`                                     |
| `POST /api/stripe/webhook`                               | Stripe webhook handler (subscription lifecycle + payment failure)                               |

### Cron job (`src/app/api/cron/ai-popular/route.ts`)

- Runs daily at 06:00 UTC (configured in `vercel.json`)
- Auth: `Authorization: Bearer $CRON_SECRET` header (Vercel adds this automatically)
- Fetches top 10 movies + top 10 TV shows being positively discussed in Western/mainstream online communities (Reddit etc.)
- **Regional focus**: English-speaking countries (US, UK, AU, CA, IE) + Western Europe. Non-Western content (South Asian, East Asian, etc.) excluded unless theatrically distributed in US/UK by a major studio AND reviewed by mainstream English-language critics. IMDb global rankings and diaspora viewership do not count as crossover. The prompt uses the US IMDb chart (not the global chart) to avoid skew from non-Western audiences.
- Resolves AI-returned title strings to TMDB IDs, enriches with poster/description, stores in `ai_popular_titles`
- Guard: skips DB write if 0 titles resolved (preserves previous day's data)
- **New-first ordering**: before inserting, the previous day's `tmdb_id`s are queried. Titles absent from the previous batch get lower rank values (appear first in the carousel); returning/duplicate titles follow in their original AI-returned order. Logic lives in exported `prioritiseNewTitles(resolved, prevTmdbIds)` in `src/app/api/cron/ai-popular/route.ts`.

### Feature tiers

| Feature                    | Not logged in | Free account              | Pro (£1.99/month)        |
| -------------------------- | ------------- | ------------------------- | ------------------------ |
| TMDB popular movies & TV   | ✓             | ✓                         | ✓                        |
| Daily AI picks             | ✓             | ✓                         | ✓                        |
| Title search               | ✓             | ✓                         | ✓                        |
| Title detail pages         | ✓             | ✓                         | ✓                        |
| Watchlist                  | -             | ✓                         | ✓                        |
| Rate titles (1-5 stars)    | -             | ✓                         | ✓                        |
| AI profile recommendations | -             | 3 lifetime calls          | 100 calls/month          |
| AI seed recommendations    | -             | 3 lifetime calls (shared) | 100 calls/month (shared) |
| Manage subscription        | -             | -                         | ✓ (Stripe portal)        |

- Free and Pro recommendation call counts are **shared** across profile mode and seed mode.
- Free call counter: `users.free_rec_calls_used` - increments on fresh generation only, not cache reads.
- Pro call counter: `users.pro_rec_calls_this_period` - resets to 0 on every Stripe `subscription.created` / `subscription.updated` webhook (i.e., each billing renewal).

### Stripe subscription paywall

- **Plan**: TellySauce Pro, £1.99/month (monthly only), GBP
- **Gated features**: `POST /api/recommend` (both profile and seed mode). Daily AI picks are free.
- **Free tier**: 3 lifetime recommendation generations per user (tracked via `free_rec_calls_used` on `users`). Counter only increments on fresh generation, not on cache reads (`GET /api/recommendations`).
- **Pro tier**: 100 recommendation generations per billing period (tracked via `pro_rec_calls_this_period` on `users`). Resets on Stripe renewal webhook.
- **Gate logic** (`src/app/api/recommend/route.ts`): free users blocked at 3 calls (`{ error: 'subscription_required' }`); Pro users blocked at 100 calls (`{ error: 'monthly_limit_reached' }`). Both return HTTP 402.
- **Paywall UI** (`src/components/recommendations/PaywallModal.tsx`): modal shown when client receives 402. Accepts `reason` prop (`'free_exhausted'` | `'monthly_limit'`) to show appropriate copy. Handled in `RecommendationsSection.tsx` via `useRecommendations` hook's `paywallError` / `clearPaywall`.
- **Stripe client**: `src/lib/stripe.ts` - singleton used by all Stripe API routes.
- **Webhook events handled**: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- **Local dev webhook**: run `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Use the `whsec_...` it prints as `STRIPE_WEBHOOK_SECRET` - this is different from the dashboard secret.
- **Billing portal**: subscribers can manage/cancel via Stripe hosted portal (`POST /api/stripe/portal`). Accessible via the "Pro · Manage" button shown to subscribed users in the header.
- **Pricing page**: `src/app/pricing/page.tsx` - server component showing Free vs Pro tier comparison. `CheckoutButton` client component (`src/app/pricing/CheckoutButton.tsx`) handles Stripe checkout redirect. Linked from footer.

## Frontend structure

### Component directory layout

Components are organised by domain under `src/components/`:

```
src/components/
├── common/          # Container, Section, SectionHeader, SectionList, PillTabs,
│                    # Footer, CookieBanner, EmptyStateCard, AuthButton
├── layout/          # Hero, HeroSection, Backdrop, BackLink, HomeClient
├── title/           # TitleCard, TitleList, TitleHeader, TitleStatusBadge, MetaPills,
│                    # TitleActions, TitleGridFilters, Overview, TagsList, ExternalLinks,
│                    # WhereToWatch, TrailerWithPosterOverlay, RedditQuotes, ResultsTable,
│                    # PosterCard, PopularTitles
├── search/          # Search, SearchResults
├── badges/          # BadgeProvider, BadgeTrophyCase, BadgeUnlockModal,
│                    # BadgeCelebration, BadgeRosette, BadgeShelf
├── recommendations/ # RecommendationsSection, PaywallModal
└── watchlist/       # Watchlist, RatedTitles, UserTitleList, StarRating, WatchlistButton
```

Import with full paths: `@/components/title/TitleCard`, `@/components/common/Section`, etc.

### Key components

- `src/app/page.tsx` - homepage (async server component). Fetches AI picks directly from the DB in parallel and passes them as props to `HomeClient`.
- `src/components/layout/HomeClient.tsx` - client component (`"use client"`) containing all the interactive homepage logic: search, auth state, subscription banner/portal. Receives `aiMovies` and `aiTv` as props from `page.tsx`.
- `src/components/title/PopularTitles.tsx` - handles both TMDB and AI picks via `source` prop. `source="ai"` hides the timeframe tabs and shows a different title. Accepts optional `initialTitles` prop (passed as SWR `fallbackData` with `revalidateOnMount: false`) so AI picks render from server data without a client fetch.
- `src/components/recommendations/RecommendationsSection.tsx` - on-demand AI recommendations (profile + seed mode). Delegates all fetch/cache/POST/paywall logic to `useRecommendations` hook. Renders results using the standard `TitleList` carousel + `TitleCard`.
- `src/components/watchlist/UserTitleList.tsx` - shared parameterised component used by both `Watchlist` and `RatedTitles`. Contains filter state and grid/carousel rendering. `Watchlist` and `RatedTitles` are thin wrappers that supply their hook data and config props.
- `src/hooks/useDiscoverTitles.ts` - SWR hook, accepts `{ timeframe?, source?, initialData? }` options. When `initialData` is set, it is used as SWR `fallbackData` and `revalidateOnMount` is disabled.
- `src/hooks/useRecommendations.ts` - hook encapsulating recommendation fetch/cache/generate/paywall logic. Returns `{ titles, isLoading, paywallError, clearPaywall, generate, key }`.
- `src/hooks/useSubscriptionStatus.ts` - fetches `GET /api/subscription-status` once when the user logs in. Returns `{ subscriptionStatus, freeRecCallsUsed } | null`.
- `src/server/aiPopular.ts` - two server-only DB helpers: `fetchAiPopularTitles(mediaType)` (used by the homepage to SSR the AI picks carousels) and `fetchAiPopularData(tmdbId, mediaType)` (used by the title detail page for the Reddit quotes / AI reason panel). Both query `ai_popular_titles` and return `[]` / `null` on error rather than throwing.

### Session pre-loading (eliminates auth flash)

`src/app/layout.tsx` calls `getServerSession(authOptions)` and passes the result to `Providers`. `src/app/providers.tsx` forwards it to `SessionProvider` as the `session` prop. This means `useSession()` starts with the correct status on first render — no "loading" phase and no flash of unauthenticated UI.

### Card status overlay

- `TitleStatusBadge` (`src/components/title/TitleStatusBadge.tsx`) - small bottom-left badge on carousel cards showing watchlist (emerald bookmark) or rated (amber star + number) status. Only visible to logged-in users.
- Enabled via `showStatusOverlay` prop on `TitleCard` and `TitleList`. Pass `showStatusOverlay` on `TitleList` to enable per-carousel.
- Active on AI picks, TMDB popular carousels (`PopularTitles`), and recommendations (`RecommendationsSection`). NOT active on Watchlist or RatedTitles - those use `renderItem`.

### Gamification badges

15 badges - 5 tiers across 3 categories. The catalogue (`src/lib/badges.ts`) is the single source of truth for thresholds, names and copy, and is imported by both server and client.

| Category | Counts | Thresholds |
| --- | --- | --- |
| `watchlist` | `user_titles` rows with `status = 'WATCHLIST'` | 5 / 15 / 30 / 50 / 100 |
| `rated` | `user_titles` rows with `status = 'RATED'` | 5 / 15 / 30 / 50 / 100 |
| `recs` | `users.lifetime_rec_calls` | 1 / 3 / 10 / 25 / 50 |

- **Backend-driven.** `awardBadges(userId, category)` in `src/server/badges.ts` counts, then inserts every met tier with `ON CONFLICT DO NOTHING ... RETURNING badge_key`, so it returns only genuinely new awards. Idempotent and race-safe, which matters because the `neon-http` driver has no transactions. It never throws - a badge failure must not break the write that triggered it.
- **Two award paths.** On write (`POST /api/watchlist`, `/api/rated`, `/api/recommend` each return `unlockedBadges: string[]`), and on read - `GET /api/badges` calls `awardAllBadges` first so a user whose history predates the feature is caught up rather than seeing met-but-locked tiers.
- **`users.lifetime_rec_calls`** exists because `free_rec_calls_used` caps at 3 and `pro_rec_calls_this_period` resets each billing cycle, so neither can drive a lifetime milestone. Incremented in `recordRecCall()` in the recommend route.
- **Celebration policy.** `BadgeProvider` (`src/components/badges/BadgeProvider.tsx`, mounted in `providers.tsx`) queues unlocks and shows **only the highest new tier per category**, marking the rest seen silently - otherwise an established account gets a stack of modals. It also fetches `/api/badges` on mount to catch unlocks whose modal never appeared.
- **Trophy case.** `BadgeTrophyCase.tsx` is a tab pinned to the right edge (`z-40`, under the `z-60` modal layer) showing a numberless gold rosette and an earned count; clicking it opens a tray with all three categories. It is rendered by `BadgeProvider`, so it is global - which is also the only place recommendation badges surface, since no page lists AI recommendations. Badges are deliberately *not* shown inline on `/watchlist` or `/all-rated-titles`.
- **Progress** comes from `GET /api/badges` (`{ badges, progress }`), so the tray needs no watchlist/ratings hooks of its own.
- **Art** is `BadgeRosette.tsx`, an original parametric SVG - 12 petals, ribbon tails, tier numeral, one palette table for all five tiers. `showNumber={false}` gives the plain rosette used as the trophy case icon. No external asset, no attribution.
- **Animation** is `lottie-react` playing `src/components/badges/celebration.json` (extracted from `public/nice.lottie`, a dotLottie ZIP that `lottie-react` cannot read directly). Loaded via `next/dynamic` so it stays out of every other page's bundle.

## Coding conventions

- Raw SQL via `db.execute(sql\`...\`)` for complex queries; Drizzle ORM for schema definition
- `mediaTypeEnum` ("tv" | "movie") is a shared pgEnum - reuse it for any new table with a media type column
- API routes that talk to the DB should handle the case where a table is empty/missing and return `{ titles: [] }` rather than 500
- No new components for single-use UI - extend existing ones with props where the addition is small
