import { http, HttpResponse } from "msw";

// ---------------------------------------------------------------------------
// TMDB
// ---------------------------------------------------------------------------
export const tmdbHandlers = [
  http.get("https://api.themoviedb.org/3/*", () =>
    HttpResponse.json({ results: [], total_results: 0 })
  ),
  http.get("https://api.themoviedb.org/4/*", () =>
    HttpResponse.json({ results: [], total_results: 0 })
  ),
];

// ---------------------------------------------------------------------------
// Internal API routes
// ---------------------------------------------------------------------------
export const apiHandlers = [
  http.get("/api/discover", () =>
    HttpResponse.json({ titles: [] })
  ),

  http.get("/api/autocomplete", () =>
    HttpResponse.json({ results: [] })
  ),

  http.get("/api/resolve-title", () =>
    HttpResponse.json({ title: null })
  ),

  http.get("/api/watchlist", () =>
    HttpResponse.json({ titles: [] })
  ),

  http.post("/api/watchlist", () =>
    HttpResponse.json({ success: true })
  ),

  http.delete("/api/watchlist", () =>
    HttpResponse.json({ success: true })
  ),

  http.get("/api/rated", () =>
    HttpResponse.json({ titles: [] })
  ),

  http.post("/api/rated", () =>
    HttpResponse.json({ success: true })
  ),

  http.get("/api/rating", () =>
    HttpResponse.json({ rating: null })
  ),

  http.get("/api/recommendations", () =>
    HttpResponse.json({ recommendations: null })
  ),

  http.post("/api/recommendations", () =>
    HttpResponse.json({ success: true })
  ),

  http.post("/api/recommend", () =>
    HttpResponse.json({ recommendations: [] })
  ),

  http.get("/api/subscription-status", () =>
    HttpResponse.json({ subscriptionStatus: null, freeRecCallsUsed: 0 })
  ),

  http.post("/api/stripe/checkout", () =>
    HttpResponse.json({ url: "https://checkout.stripe.com/test" })
  ),

  http.post("/api/stripe/portal", () =>
    HttpResponse.json({ url: "https://billing.stripe.com/test" })
  ),
];

export const handlers = [...tmdbHandlers, ...apiHandlers];
