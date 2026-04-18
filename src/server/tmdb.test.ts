import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { fetchTMDBTitle, TMDB_BASE } from "./tmdb";

// Ensure a TMDB_ACCESS_TOKEN is set so tmdbRequest doesn't throw
beforeEach(() => {
  vi.stubEnv("TMDB_ACCESS_TOKEN", "test-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const mockMovie = {
  id: 550,
  title: "Fight Club",
  overview: "An insomniac office worker forms an underground fight club.",
  poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
  release_date: "1999-10-15",
};

const mockTvShow = {
  id: 1396,
  name: "Breaking Bad",
  overview: "A high school chemistry teacher turns to producing methamphetamine.",
  poster_path: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  first_air_date: "2008-01-20",
};

describe("fetchTMDBTitle", () => {
  describe("movie", () => {
    it("returns a correctly shaped TMDBTitle for a movie", async () => {
      server.use(
        http.get(`${TMDB_BASE}/movie/:id`, () => HttpResponse.json(mockMovie))
      );

      const result = await fetchTMDBTitle(550, "movie");

      expect(result).not.toBeNull();
      expect(result!.tmdbId).toBe(550);
      expect(result!.mediaType).toBe("movie");
      expect(result!.title).toBe("Fight Club");
      expect(result!.poster).toBe(
        "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
      );
      expect(result!.year).toBe(1999);
      expect(result!.description).toBe(
        "An insomniac office worker forms an underground fight club."
      );
    });

    it("returns null poster when poster_path is absent", async () => {
      server.use(
        http.get(`${TMDB_BASE}/movie/:id`, () =>
          HttpResponse.json({ ...mockMovie, poster_path: null })
        )
      );

      const result = await fetchTMDBTitle(550, "movie");
      expect(result!.poster).toBeNull();
    });

    it("returns null year when release_date is absent", async () => {
      server.use(
        http.get(`${TMDB_BASE}/movie/:id`, () =>
          HttpResponse.json({ ...mockMovie, release_date: undefined })
        )
      );

      const result = await fetchTMDBTitle(550, "movie");
      expect(result!.year).toBeNull();
    });

    it("returns null year for malformed date string", async () => {
      server.use(
        http.get(`${TMDB_BASE}/movie/:id`, () =>
          HttpResponse.json({ ...mockMovie, release_date: "bad-date" })
        )
      );

      const result = await fetchTMDBTitle(550, "movie");
      expect(result!.year).toBeNull();
    });

    it("returns null for 404 response", async () => {
      server.use(
        http.get(`${TMDB_BASE}/movie/:id`, () =>
          new HttpResponse(null, { status: 404 })
        )
      );

      const result = await fetchTMDBTitle(9999999, "movie");
      expect(result).toBeNull();
    });

    it("throws for non-404 error responses", async () => {
      server.use(
        http.get(`${TMDB_BASE}/movie/:id`, () =>
          new HttpResponse("Internal Server Error", { status: 500 })
        )
      );

      await expect(fetchTMDBTitle(550, "movie")).rejects.toThrow(
        /TMDB fetch failed: 500/
      );
    });
  });

  describe("tv", () => {
    it("returns a correctly shaped TMDBTitle for a TV show", async () => {
      server.use(
        http.get(`${TMDB_BASE}/tv/:id`, () => HttpResponse.json(mockTvShow))
      );

      const result = await fetchTMDBTitle(1396, "tv");

      expect(result).not.toBeNull();
      expect(result!.tmdbId).toBe(1396);
      expect(result!.mediaType).toBe("tv");
      expect(result!.title).toBe("Breaking Bad");
      expect(result!.poster).toBe(
        "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg"
      );
      expect(result!.year).toBe(2008);
      expect(result!.description).toBe(
        "A high school chemistry teacher turns to producing methamphetamine."
      );
    });

    it("uses name field for TV (not title)", async () => {
      server.use(
        http.get(`${TMDB_BASE}/tv/:id`, () =>
          HttpResponse.json({ ...mockTvShow, title: "Wrong Field" })
        )
      );

      const result = await fetchTMDBTitle(1396, "tv");
      expect(result!.title).toBe("Breaking Bad"); // uses .name not .title
    });

    it("uses first_air_date for TV year (not release_date)", async () => {
      server.use(
        http.get(`${TMDB_BASE}/tv/:id`, () =>
          HttpResponse.json({
            ...mockTvShow,
            release_date: "2000-01-01", // should be ignored
            first_air_date: "2008-01-20",
          })
        )
      );

      const result = await fetchTMDBTitle(1396, "tv");
      expect(result!.year).toBe(2008);
    });

    it("returns null for 404 TV response", async () => {
      server.use(
        http.get(`${TMDB_BASE}/tv/:id`, () =>
          new HttpResponse(null, { status: 404 })
        )
      );

      const result = await fetchTMDBTitle(9999999, "tv");
      expect(result).toBeNull();
    });
  });

  describe("missing credentials", () => {
    it("throws when neither TMDB_ACCESS_TOKEN nor TMDB_API_KEY is set", async () => {
      vi.unstubAllEnvs();
      vi.stubEnv("TMDB_ACCESS_TOKEN", "");
      vi.stubEnv("TMDB_API_KEY", "");

      await expect(fetchTMDBTitle(550, "movie")).rejects.toThrow(
        /Missing TMDB credentials/
      );
    });
  });
});
