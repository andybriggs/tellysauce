import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import RecommendationsSection from "./RecommendationsSection";
import { useRatedTitles } from "@/hooks/useRatedTitles";

// ---- Standard component mocks ----
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@heroicons/react/24/solid", () => ({
  ArrowPathIcon: () => <svg data-testid="loading-icon" />,
  SparklesIcon: () => <svg data-testid="sparkles-icon" />,
  ChevronLeftIcon: () => <svg />,
  ChevronRightIcon: () => <svg />,
  StarIcon: () => <svg />,
  BookmarkIcon: () => <svg />,
}));

vi.mock("embla-carousel-react", () => ({
  default: () => [
    vi.fn(),
    {
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
      canScrollPrev: vi.fn(() => false),
      canScrollNext: vi.fn(() => false),
      on: vi.fn(),
      off: vi.fn(),
    },
  ],
}));

vi.mock("./TitleStatusBadge", () => ({ default: () => null }));

vi.mock("@/hooks/useRatedTitles", () => ({
  useRatedTitles: vi.fn(() => ({
    ratedTitles: [
      { id: 1, name: "Inception", type: "movie", rating: 5, poster: null, description: null },
    ],
    isLoading: false,
    getRating: vi.fn(() => 0),
    isSubmittingId: vi.fn(() => false),
    rateTitle: vi.fn(),
  })),
}));

vi.mock("@/hooks/useWatchList", () => ({
  useWatchList: vi.fn(() => ({
    watchList: [],
    isLoading: false,
  })),
}));

/** Fake recommendation items returned by the GET cache endpoint. */
const fakeItems = [
  {
    id: "item-1",
    setId: "set-1",
    rank: 0,
    title: "Parasite",
    description: "Dark Korean thriller.",
    reason: "Matches dark humor.",
    tags: ["drama", "thriller"],
    year: 2019,
    mediaType: "movie",
    suggestedMediaType: "movie",
    suggestedTmdbId: 496243,
    poster: "https://image.tmdb.org/t/p/w342/parasite.jpg",
  },
];

/** Fake POST /api/recommend response. */
const fakePostRecs = [
  {
    title: "The Matrix",
    description: "A hacker discovers reality.",
    reason: "Great sci-fi.",
    tags: ["sci-fi", "action"],
    year: 1999,
    mediaType: "movie",
    resolvedTmdbId: 603,
    poster: "https://image.tmdb.org/t/p/w342/matrix.jpg",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RecommendationsSection", () => {
  it("renders the Get Recommendations button", () => {
    // No cached recs on mount
    server.use(
      http.get("/api/recommendations", () =>
        HttpResponse.json({ set: null, items: [] })
      )
    );

    render(<RecommendationsSection />);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getAllByText(/Get/i).length).toBeGreaterThan(0);
  });

  it("shows cached recommendations on mount without button click", async () => {
    server.use(
      http.get("/api/recommendations", () =>
        HttpResponse.json({ set: { id: "set-1" }, items: fakeItems })
      )
    );

    render(<RecommendationsSection />);

    await waitFor(() => {
      expect(screen.getByText("Parasite")).toBeInTheDocument();
    });
  });

  it("shows Refresh button text when recommendations are already loaded", async () => {
    server.use(
      http.get("/api/recommendations", () =>
        HttpResponse.json({ set: { id: "set-1" }, items: fakeItems })
      )
    );

    render(<RecommendationsSection />);

    await waitFor(() => {
      expect(screen.getAllByText(/Refresh/i).length).toBeGreaterThan(0);
    });
  });

  it("fetches recommendations on button click and displays results", async () => {
    server.use(
      http.get("/api/recommendations", () =>
        HttpResponse.json({ set: null, items: [] })
      ),
      http.post("/api/recommend", () =>
        HttpResponse.json({ recommendations: fakePostRecs, key: "profile:3", setId: "set-1" })
      )
    );

    render(<RecommendationsSection />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("The Matrix")).toBeInTheDocument();
    });
  });

  it("shows free-exhausted paywall modal when API returns 402 subscription_required", async () => {
    server.use(
      http.get("/api/recommendations", () =>
        HttpResponse.json({ set: null, items: [] })
      ),
      http.post("/api/recommend", () =>
        HttpResponse.json({ error: "subscription_required" }, { status: 402 })
      )
    );

    render(<RecommendationsSection />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText(/free recommendations used up/i)).toBeInTheDocument();
    });
  });

  it("shows monthly-limit paywall modal when API returns 402 monthly_limit_reached", async () => {
    server.use(
      http.get("/api/recommendations", () =>
        HttpResponse.json({ set: null, items: [] })
      ),
      http.post("/api/recommend", () =>
        HttpResponse.json({ error: "monthly_limit_reached" }, { status: 402 })
      )
    );

    render(<RecommendationsSection />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText(/monthly limit reached/i)).toBeInTheDocument();
    });
  });

  it("renders custom buttonLabel in seed mode", () => {
    server.use(
      http.get("/api/recommendations", () =>
        HttpResponse.json({ set: null, items: [] })
      )
    );

    const seed = {
      title: "Breaking Bad",
      type: "tv" as const,
      external: { tmdbId: 1396 },
    };

    // In seed mode, the section only renders if the title is in the user's list.
    // Mock useRatedTitles to include the seed title.
    vi.mocked(useRatedTitles).mockReturnValue({
      ratedTitles: [{ id: 1396, name: "Breaking Bad", type: "tv", rating: 5, poster: null, description: null }],
      isLoading: false,
      getRating: vi.fn(() => 0),
      isSubmittingId: vi.fn(() => false),
      rateTitle: vi.fn(),
      isSaved: vi.fn(() => true),
      error: undefined,
      hasMounted: true,
      isSubmittingAny: false,
      mutate: vi.fn(),
    } as never);

    render(<RecommendationsSection seed={seed} buttonLabel="More like this" />);

    expect(screen.getByText("More like this")).toBeInTheDocument();
  });

  it("does not render in seed mode when title is not in user's list", () => {
    server.use(
      http.get("/api/recommendations", () =>
        HttpResponse.json({ set: null, items: [] })
      )
    );

    const seed = {
      title: "Some Unknown Show",
      type: "tv" as const,
      external: { tmdbId: 99999 },
    };

    const { container } = render(
      <RecommendationsSection seed={seed} buttonLabel="More like this" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders loading skeleton while fetching", async () => {
    let resolvePost: (v: unknown) => void;
    const postPending = new Promise((res) => { resolvePost = res; });

    server.use(
      http.get("/api/recommendations", () =>
        HttpResponse.json({ set: null, items: [] })
      ),
      http.post("/api/recommend", async () => {
        await postPending;
        return HttpResponse.json({ recommendations: [], key: "profile:3" });
      })
    );

    render(<RecommendationsSection />);
    fireEvent.click(screen.getByRole("button"));

    // Skeleton divs are rendered while loading
    await waitFor(() => {
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    resolvePost!(undefined);
  });
});
