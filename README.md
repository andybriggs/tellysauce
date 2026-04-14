# TellySauce

A Next.js 15 web app for discovering, rating, and getting AI-powered recommendations for TV shows and movies.

Users can search for titles, maintain a watchlist, rate shows/movies 1–5 stars, and receive personalised Gemini AI recommendations. The homepage also features daily AI-curated picks sourced from online community buzz.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Database**: PostgreSQL via [Neon](https://neon.tech) (serverless), Drizzle ORM
- **Auth**: NextAuth.js v4, Google OAuth
- **AI**: Google Gemini (`@google/genai`) — 2-stage pipeline (grounded search + JSON structuring)
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

| Variable | Description |
|----------|-------------|
| `TMDB_API_KEY` | TMDB v3 API key |
| `TMDB_ACCESS_TOKEN` | TMDB v4 Bearer token (used for all requests) |
| `GOOGLE_GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL_GROUNDED` | Model for grounded search stage (default: `gemini-2.5-flash`) |
| `GEMINI_MODEL_STRUCT` | Model for JSON structuring stage (default: `gemini-2.5-flash-lite`) |
| `DATABASE_URL` | Neon PostgreSQL connection string (pooled) |
| `DATABASE_URL_UNPOOLED` | Neon PostgreSQL connection string (direct, for migrations) |
| `NEXTAUTH_SECRET` | NextAuth secret |
| `NEXTAUTH_URL` | App base URL (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `CRON_SECRET` | Bearer token for Vercel cron authentication |
| `NEXT_PUBLIC_CACHE_VERSION` | Cache-busting version for client-side SWR requests |

## Database

The project uses Drizzle ORM with a Neon PostgreSQL database.

### Schema

| Table | Purpose |
|-------|---------|
| `users` | Google OAuth users |
| `titles` | TMDB title cache (keyed by `tmdb_id` + `media_type`) |
| `user_titles` | Watchlist entries and ratings (`status`: `WATCHLIST` \| `RATED`, `rating`: 1–5) |
| `recommendation_sets` | Cached Gemini recommendation batches (7-day expiry) |
| `recommendation_items` | Individual titles within a recommendation set |
| `ai_popular_titles` | Daily AI-curated popular titles populated by the cron job |

### Scripts

```bash
yarn db:generate   # Generate Drizzle migration files from schema changes
yarn db:push       # Push schema changes directly to the database
yarn db:studio     # Open Drizzle Studio (database browser)
```

> **Note:** `db:push` can get stuck prompting about existing constraints. When that happens, run the SQL statements directly via `@neondatabase/serverless` using `DATABASE_URL_UNPOOLED`.

## API Routes

### Public

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/discover?type=movie\|tv&timeframe=recent\|all` | TMDB popular or top-rated titles |
| `GET` | `/api/discover?type=movie\|tv&source=ai` | Daily AI picks from the `ai_popular_titles` table |
| `GET` | `/api/autocomplete?q={query}` | TMDB title search for the search bar |
| `GET` | `/api/resolve-title?title={title}&type=movie\|tv` | Advanced TMDB title resolution with scoring |

### Authenticated (requires session)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/watchlist` | Get the current user's watchlist |
| `POST` | `/api/watchlist` | Add a title to the watchlist |
| `DELETE` | `/api/watchlist` | Remove a title from the watchlist |
| `GET` | `/api/rated` | Get all titles the current user has rated |
| `POST` | `/api/rated` | Rate a title (1–5 stars) |
| `GET` | `/api/rating?tmdbId={id}&type=movie\|tv` | Get the current user's rating for a specific title |
| `GET` | `/api/recommendations` | Fetch cached Gemini recommendations for the current user |
| `POST` | `/api/recommend` | Generate Gemini AI recommendations (profile or seed mode) |

### Cron (Vercel internal)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/cron/ai-popular` | Daily job: fetch AI picks via Gemini, resolve via TMDB, store in DB |

The cron route requires `Authorization: Bearer $CRON_SECRET`. Vercel adds this header automatically when the env var is set. To trigger manually:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-domain>/api/cron/ai-popular
```

## AI Features

### Gemini 2-Stage Pipeline

All Gemini calls follow a consistent two-stage pattern:

1. **Stage 1 — Grounded search** (`GEMINI_MODEL_GROUNDED` + `googleSearch` tool): generates free-text results grounded in real-time web data
2. **Stage 2 — JSON structuring** (`GEMINI_MODEL_STRUCT` + `responseMimeType: "application/json"`): converts the grounded text into a typed JSON array

Helper functions (`extractModelText`, `parseLines`, `parseJsonArrayOfRecs`) live in `src/app/api/recommend/route.ts` and are copied into the cron route.

### Daily AI Picks (Cron)

Scheduled daily at 06:00 UTC. The job:

1. Uses Gemini (with Google Search grounding) to find the 10 most positively discussed movies and TV shows from the past 7 days across Reddit and similar communities
2. Resolves each title string to a TMDB ID, then enriches with poster, description, and year
3. Stores results in `ai_popular_titles` with a `fetched_date` batch key

**Regional focus**: prioritises English-speaking markets (US, UK, AU, CA, IE) and Western Europe. East Asian content is included only for major Western crossovers (e.g. Squid Game, Parasite).

**Guard**: if 0 titles resolve successfully, the DB write is skipped and the previous day's data is preserved.

### Personalised Recommendations

The `/api/recommend` route uses the user's rating history to generate a personalised recommendation list via Gemini. Results are cached in `recommendation_sets` / `recommendation_items` for 7 days.

## TMDB Integration

All TMDB requests use the v4 Bearer token (`TMDB_ACCESS_TOKEN`).

- `fetchTMDBTitle(tmdbId, mediaType)` — `src/server/tmdb.ts` — canonical function for fetching full title details
- Title search year params differ by media type: movies use `year`, TV shows use `first_air_date_year`

## Deployment

Deployed on Vercel. The `vercel.json` at the project root configures the daily cron job. Make sure `CRON_SECRET` is set in your Vercel project environment variables — Vercel uses it to authenticate cron requests automatically.
