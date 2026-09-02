import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import BadgeShelf from "./BadgeShelf";
import type { BadgeProgress } from "@/hooks/useBadges";

const mockUseBadges = vi.fn();

vi.mock("@/hooks/useBadges", () => ({
  useBadges: () => mockUseBadges(),
}));

const NO_PROGRESS: BadgeProgress = { watchlist: 0, rated: 0, recs: 0 };

const badgesState = (
  earned: string[] = [],
  dates: Record<string, string> = {},
  progress: Partial<BadgeProgress> = {}
) => ({
  badges: earned.map((key) => ({ key, seen: true, awardedAt: dates[key] ?? "" })),
  earnedKeys: new Set(earned),
  progress: { ...NO_PROGRESS, ...progress },
  earnedCount: earned.length,
  totalCount: 15,
  isEarned: (key: string) => earned.includes(key),
  awardedAt: (key: string) => dates[key],
  isLoading: false,
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseBadges.mockReturnValue(badgesState());
});

describe("BadgeShelf", () => {
  it("renders the category heading", () => {
    render(<BadgeShelf category="watchlist" />);
    expect(screen.getByText("Watchlist badges")).toBeInTheDocument();
  });

  it("renders all 5 tiers for the category", () => {
    render(<BadgeShelf category="rated" />);
    expect(screen.getByText("Star Struck")).toBeInTheDocument();
    expect(screen.getByText("Golden Palate")).toBeInTheDocument();
  });

  it("shows the earned count", () => {
    mockUseBadges.mockReturnValue(badgesState(["rated_5", "rated_15"]));
    render(<BadgeShelf category="rated" />);
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("shows the award date on earned badges", () => {
    mockUseBadges.mockReturnValue(
      badgesState(["rated_5"], { rated_5: "2026-01-15T10:00:00.000Z" })
    );
    render(<BadgeShelf category="rated" />);
    expect(screen.getByText("15 Jan 2026")).toBeInTheDocument();
  });

  it("shows progress against unearned tiers", () => {
    mockUseBadges.mockReturnValue(badgesState([], {}, { rated: 22 }));
    render(<BadgeShelf category="rated" />);
    expect(screen.getByText("22/30")).toBeInTheDocument();
  });

  it("caps progress at the tier threshold", () => {
    mockUseBadges.mockReturnValue(badgesState([], {}, { rated: 99 }));
    render(<BadgeShelf category="rated" />);
    // tier 1 threshold is 5, so it must not read "99/5"
    expect(screen.getByText("5/5")).toBeInTheDocument();
  });

  it("reads progress for its own category only", () => {
    mockUseBadges.mockReturnValue(
      badgesState([], {}, { rated: 22, watchlist: 7 })
    );
    render(<BadgeShelf category="watchlist" />);
    expect(screen.getByText("7/15")).toBeInTheDocument();
    expect(screen.queryByText("22/30")).not.toBeInTheDocument();
  });

  it("does not show progress on an earned badge", () => {
    mockUseBadges.mockReturnValue(
      badgesState(["rated_5"], { rated_5: "2026-01-15T10:00:00.000Z" }, { rated: 22 })
    );
    render(<BadgeShelf category="rated" />);
    expect(screen.queryByText("22/5")).not.toBeInTheDocument();
  });
});
