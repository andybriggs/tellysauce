# Telly Sauce

A Next.js 15 web app for discovering, rating, and getting AI-powered recommendations for TV shows and movies.

Users can search for titles, maintain a watchlist, rate shows/movies 1-5 stars, and receive personalised AI recommendations. The homepage also features daily AI-curated picks sourced from online community buzz.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Database**: PostgreSQL via [Neon](https://neon.tech) (serverless), Drizzle ORM
- **Auth**: NextAuth.js v4, Google OAuth
- **AI**: OpenAI (`openai`) - single-call structured output for recommendations; Responses API with `web_search_preview` for cron
- **Payments**: Stripe - £1.99/month subscription gating AI recommendations
- **Data fetching**: SWR (client-side), Next.js fetch with ISR (server-side)
- **Styling**: TailwindCSS, Embla Carousel
- **Deployment**: Vercel (includes cron jobs via `vercel.json`)

## Getting Started

Install dependencies:

```bash
yarn install
```

Copy `.env.local.example` to `.env.local` and fill in the required values (see [Environment Variables](#environment-variables) below).

Run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable                    | Description                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TMDB_API_KEY`              | TMDB v3 API key                                                                                                                                                                                                     |
| `TMDB_ACCESS_TOKEN`         | TMDB v4 Bearer token (used for all requests)                                                                                                                                                                        |
| `OPENAI_API_KEY`            | OpenAI API key - used for recommendations and cron web search                                                                                                                                                       |
| `DATABASE_URL`              | Neon PostgreSQL connection string (pooled)                                                                                                                                                                          |
| `DATABASE_URL_UNPOOLED`     | Neon PostgreSQL connection string (direct, for migrations)                                                                                                                                                          |
| `NEXTAUTH_SECRET`           | NextAuth secret                                                                                                                                                                                                     |
| `NEXTAUTH_URL`              | App base URL (e.g. `http://localhost:3000`)                                                                                                                                                                         |
| `GOOGLE_CLIENT_ID`          | Google OAuth client ID                                                                                                                                                                                              |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth client secret                                                                                                                                                                                          |
| `CRON_SECRET`               | Bearer token for Vercel cron authentication                                                                                                                                                                         |
| `NEXT_PUBLIC_CACHE_VERSION` | Cache-busting version for client-side SWR requests                                                                                                                                                                  |
| `STRIPE_SECRET_KEY`         | Stripe secret key (`sk_test_...` locally, `sk_live_...` on Vercel)                                                                                                                                                  |
| `STRIPE_WEBHOOK_SECRET`     | Stripe webhook signing secret (see note below)                                                                                                                                                                      |
| `STRIPE_PRICE_ID`           | Stripe Price ID for the £1.99/month Pro plan (`price_...`)                                                                                                                                                          |
| `OMDB_API_KEY`              | OMDb API key for fetching IMDb and Rotten Tomatoes ratings on title pages - free tier (1,000 req/day) at [omdbapi.com](https://www.omdbapi.com/apikey.aspx). If unset, both rating pills are hidden. |

## Database

The project uses Drizzle ORM with a Neon PostgreSQL database.

### Schema

| Table                  | Purpose                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| `users`                | Google OAuth users + Stripe subscription state                                  |
| `titles`               | TMDB title cache (keyed by `tmdb_id` + `media_type`)                            |
| `user_titles`          | Watchlist entries and ratings (`status`: `WATCHLIST` \| `RATED`, `rating`: 1-5) |
| `recommendation_sets`  | Cached AI recommendation batches (7-day expiry)                                 |
| `recommendation_items` | Individual titles within a recommendation set                                   |
| `ai_popular_titles`    | Daily AI-curated popular titles populated by the cron job                       |

### Scripts

```bash
yarn db:generate   # Generate Drizzle migration files from schema changes
yarn db:push       # Push schema changes directly to the database
yarn db:studio     # Open Drizzle Studio (database browser)
```

> **Note:** `db:push` can get stuck prompting about existing constraints. When that happens, run the SQL statements directly via `@neondatabase/serverless` using `DATABASE_URL_UNPOOLED`.

## API Routes

### Public

| Method | Route                                                | Description                                       |
| ------ | ---------------------------------------------------- | ------------------------------------------------- |
| `GET`  | `/api/discover?type=movie\|tv&timeframe=recent\|all` | TMDB popular or top-rated titles                  |
| `GET`  | `/api/discover?type=movie\|tv&source=ai`             | Daily AI picks from the `ai_popular_titles` table |
| `GET`  | `/api/autocomplete?q={query}`                        | TMDB title search for the search bar              |
| `GET`  | `/api/resolve-title?title={title}&type=movie\|tv`    | Advanced TMDB title resolution with scoring       |

### Authenticated (requires session)

| Method   | Route                                    | Description                                                                                           |
| -------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/watchlist`                         | Get the current user's watchlist                                                                      |
| `POST`   | `/api/watchlist`                         | Add a title to the watchlist                                                                          |
| `DELETE` | `/api/watchlist`                         | Remove a title from the watchlist                                                                     |
| `GET`    | `/api/rated`                             | Get all titles the current user has rated                                                             |
| `POST`   | `/api/rated`                             | Rate a title (1-5 stars)                                                                              |
| `GET`    | `/api/rating?tmdbId={id}&type=movie\|tv` | Get the current user's rating for a specific title                                                    |
| `GET`    | `/api/recommendations`                   | Fetch cached AI recommendations for the current user                                                  |
| `POST`   | `/api/recommend`                         | Generate AI recommendations via OpenAI - subscription-gated (3 free lifetime calls, then £1.99/month) |
| `GET`    | `/api/subscription-status`               | Returns current user's subscription status and free call count                                        |
| `POST`   | `/api/stripe/checkout`                   | Create a Stripe Checkout session for TellySauce Pro                                                   |
| `POST`   | `/api/stripe/portal`                     | Create a Stripe Billing Portal session (manage/cancel subscription)                                   |

### Cron (Vercel internal)

| Method | Route                  | Description                                                                    |
| ------ | ---------------------- | ------------------------------------------------------------------------------ |
| `GET`  | `/api/cron/ai-popular` | Daily job: fetch AI picks via OpenAI web search, resolve via TMDB, store in DB |

The cron route requires `Authorization: Bearer $CRON_SECRET`. Vercel adds this header automatically when the env var is set. To trigger manually:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-domain>/api/cron/ai-popular
```

## AI Features

### OpenAI Pipeline

All AI calls use the shared `openai` client from `src/lib/ai.ts`.

**Recommendations** (`src/app/api/recommend/route.ts`): a single `gpt-4o-mini` call using `response_format: json_schema` (strict structured output). Returns `{ recommendations: [...] }` directly - no intermediate text parsing or retry loops.

**Cron** (`src/app/api/cron/ai-popular/route.ts`): a 4-stage pipeline:

1. **Web search** - `openai.responses.create` with `gpt-4o-mini` + `web_search_preview` tool. Finds trending titles from Reddit.
2. **JSON structuring** - `gpt-4o-mini` chat completions with `json_schema`. Parses the Stage 1 text into structured title objects.
3. **TMDB resolution** - enriches each title with poster, description, and year from TMDB.
4. **Quote generation** - `gpt-4o-mini` chat completions with `json_schema`. Generates Reddit-style viewer quotes per title.

### Daily AI Picks (Cron)

Scheduled daily at 06:00 UTC. The job:

1. Uses OpenAI web search (`gpt-4o-mini` + `web_search_preview` tool) to find the 10 most positively discussed movies and TV shows from the past 7 days across Reddit and similar communities
2. Resolves each title string to a TMDB ID, then enriches with poster, description, and year
3. Stores results in `ai_popular_titles` with a `fetched_date` batch key

**Regional focus**: prioritises English-speaking markets (US, UK, AU, CA, IE) and Western Europe. East Asian content is included only for major Western crossovers (e.g. Squid Game, Parasite).

**Guard**: if 0 titles resolve successfully, the DB write is skipped and the previous day's data is preserved.

**New-first ordering**: before writing today's batch, the previous day's titles are queried. Titles not seen yesterday are assigned lower rank values and appear at the start of the carousel; duplicate/returning titles follow in their AI-returned order.

### Personalised Recommendations

The `/api/recommend` route uses the user's rating history to generate a personalised recommendation list via OpenAI. Results are cached in `recommendation_sets` / `recommendation_items` for 7 days.

## TMDB Integration

All TMDB requests use the v4 Bearer token (`TMDB_ACCESS_TOKEN`).

- `fetchTMDBTitle(tmdbId, mediaType)` - `src/server/tmdb.ts` - canonical function for fetching full title details
- Title search year params differ by media type: movies use `year`, TV shows use `first_air_date_year`
- `fetchTitleSources(kind, id, revalidate)` - returns streaming providers for **all regions** as `Record<string, TitleSource[]>`. The title page passes this to `WhereToWatch`, which lets users pick their country from a dropdown. The selected region persists in `localStorage` (`watch_region` key) and auto-detects from `navigator.language` on first visit.

## Stripe Subscription

AI recommendations (profile and seed modes) are gated behind a **£1.99/month** subscription (TellySauce Pro). Users get **3 free lifetime recommendation generations** before the paywall appears. Daily AI picks remain free.

### Stripe setup

1. Create a product in the [Stripe Dashboard](https://dashboard.stripe.com/products/create) named **TellySauce Pro** with a £1.99/month recurring price. Copy the `price_...` ID into `STRIPE_PRICE_ID`.
2. Register a webhook endpoint at `/api/stripe/webhook` listening to: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

### Local webhook testing

The Stripe CLI forwards events to your local server:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

> **Important:** The `whsec_...` secret printed by `stripe listen` is different from the one in the Stripe dashboard. Use the CLI secret in `.env.local` and the dashboard secret in Vercel environment variables.

Test with card number `4242 4242 4242 4242`, any future expiry, any CVC.

## Testing

The project uses [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) + [MSW](https://mswjs.io/) for mocking.

```bash
yarn test              # Run all tests (watch mode)
yarn test:coverage     # Run with coverage report
```

Test files live next to the code they test (`*.test.ts` / `*.test.tsx`). Global test setup is in `src/test/setup.ts` and shared MSW handlers in `src/test/mocks/`.

## Deployment

Deployed on Vercel. The `vercel.json` at the project root configures the daily cron job. Make sure `CRON_SECRET` is set in your Vercel project environment variables - Vercel uses it to authenticate cron requests automatically.
