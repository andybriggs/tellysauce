import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import BadgeTrophyCase from "./BadgeTrophyCase";

const mockUseBadges = vi.fn();
const mockUseIsLoggedIn = vi.fn(() => true);

vi.mock("@/hooks/useBadges", () => ({
  useBadges: () => mockUseBadges(),
}));
vi.mock("@/hooks/useIsLoggedIn", () => ({
  default: () => mockUseIsLoggedIn(),
}));

const badgesState = (earned: string[] = []) => ({
  badges: earned.map((key) => ({ key, seen: true, awardedAt: "" })),
  earnedKeys: new Set(earned),
  progress: { watchlist: 0, rated: 0, recs: 0 },
  earnedCount: earned.length,
  totalCount: 15,
  isEarned: (key: string) => earned.includes(key),
  awardedAt: () => undefined,
  isLoading: false,
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseIsLoggedIn.mockReturnValue(true);
  mockUseBadges.mockReturnValue(badgesState(["rated_5", "watchlist_5"]));
});

describe("BadgeTrophyCase", () => {
  it("renders nothing when logged out", () => {
    mockUseIsLoggedIn.mockReturnValue(false);
    const { container } = render(<BadgeTrophyCase />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("trophy-case-tab")).not.toBeInTheDocument();
  });

  it("shows the tab with an earned count", () => {
    render(<BadgeTrophyCase />);
    expect(screen.getByTestId("trophy-case-tab")).toBeInTheDocument();
    expect(screen.getByText("2/15")).toBeInTheDocument();
  });

  it("labels the tab for assistive tech", () => {
    render(<BadgeTrophyCase />);
    expect(
      screen.getByRole("button", { name: /2 of 15 badges earned/i })
    ).toBeInTheDocument();
  });

  it("keeps the tray closed until the tab is clicked", () => {
    render(<BadgeTrophyCase />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the tray on click", () => {
    render(<BadgeTrophyCase />);
    fireEvent.click(screen.getByTestId("trophy-case-tab"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Trophy case")).toBeInTheDocument();
  });

  it("shows all three categories in the tray", () => {
    render(<BadgeTrophyCase />);
    fireEvent.click(screen.getByTestId("trophy-case-tab"));
    expect(screen.getByTestId("badge-shelf-watchlist")).toBeInTheDocument();
    expect(screen.getByTestId("badge-shelf-rated")).toBeInTheDocument();
    expect(screen.getByTestId("badge-shelf-recs")).toBeInTheDocument();
  });

  it("closes on the X button", () => {
    render(<BadgeTrophyCase />);
    fireEvent.click(screen.getByTestId("trophy-case-tab"));
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<BadgeTrophyCase />);
    fireEvent.click(screen.getByTestId("trophy-case-tab"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sits below the unlock modal in stacking order", () => {
    render(<BadgeTrophyCase />);
    // z-40 keeps the tab under the z-60 modal layer
    expect(screen.getByTestId("trophy-case-tab").className).toContain("z-40");
  });
});
