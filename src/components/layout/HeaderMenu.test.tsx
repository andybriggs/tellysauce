import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import HeaderMenu from "./HeaderMenu";

vi.mock("@/components/common/AuthButton", () => ({
  default: () => <div>auth-button</div>,
}));
vi.mock("@/components/common/RegionPicker", () => ({
  default: () => <div>region-picker</div>,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockPathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

const mockIsLoggedIn = vi.fn(() => true);
vi.mock("@/hooks/useIsLoggedIn", () => ({
  default: () => mockIsLoggedIn(),
}));

type SubStatus = { subscriptionStatus: string | null } | null;

const mockSubStatus = vi.fn((): SubStatus => null);
vi.mock("@/hooks/useSubscriptionStatus", () => ({
  useSubscriptionStatus: () => mockSubStatus(),
}));

const open = () => fireEvent.click(screen.getByTestId("header-menu-button"));

describe("HeaderMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoggedIn.mockReturnValue(true);
    mockPathname.mockReturnValue("/");
    mockSubStatus.mockReturnValue(null);
  });

  it("keeps the drawer closed until the burger is pressed", () => {
    render(<HeaderMenu />);
    expect(screen.queryByText("Menu")).toBeNull();
    open();
    expect(screen.getByText("Menu")).toBeInTheDocument();
  });

  it("collapses the region picker and account controls into the drawer", () => {
    render(<HeaderMenu />);
    open();
    expect(screen.getByText("region-picker")).toBeInTheDocument();
    expect(screen.getByText("auth-button")).toBeInTheDocument();
  });

  it("links straight to the watchlist and rated pages, which otherwise need scrolling to reach", () => {
    render(<HeaderMenu />);
    open();
    expect(screen.getByRole("link", { name: /My Watchlist/ })).toHaveAttribute(
      "href",
      "/watchlist"
    );
    expect(
      screen.getByRole("link", { name: /My Rated Titles/ })
    ).toHaveAttribute("href", "/all-rated-titles");
  });

  it("hides the personal pages from signed-out visitors", () => {
    mockIsLoggedIn.mockReturnValue(false);
    render(<HeaderMenu />);
    open();
    expect(screen.queryByRole("link", { name: /My Watchlist/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /My Rated Titles/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Pricing/ })).toBeInTheDocument();
  });

  it("marks the current page", () => {
    mockPathname.mockReturnValue("/watchlist");
    render(<HeaderMenu />);
    open();
    expect(screen.getByRole("link", { name: /My Watchlist/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /Home/ })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("closes the drawer on navigation, so the drawer is not left over the new page", () => {
    render(<HeaderMenu />);
    open();
    fireEvent.click(screen.getByRole("link", { name: /My Watchlist/ }));
    expect(screen.queryByText("Menu")).toBeNull();
  });

  it("only offers subscription management to subscribers", () => {
    render(<HeaderMenu />);
    open();
    expect(screen.queryByText(/Pro · Manage/)).toBeNull();

    fireEvent.click(screen.getByLabelText("Close"));
    mockSubStatus.mockReturnValue({ subscriptionStatus: "active" });
    open();
    expect(screen.getByText(/Pro · Manage/)).toBeInTheDocument();
  });

  it("closes the drawer when managing the subscription, so the redirect is not hidden behind it", () => {
    mockSubStatus.mockReturnValue({ subscriptionStatus: "active" });
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    render(<HeaderMenu />);
    open();
    fireEvent.click(screen.getByText(/Pro · Manage/));

    expect(fetchMock).toHaveBeenCalledWith("/api/stripe/portal", {
      method: "POST",
    });
    expect(screen.queryByText("Menu")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("is the nav at every breakpoint, not a phones-only collapse", () => {
    render(<HeaderMenu />);
    expect(screen.getByTestId("header-menu-button").className).not.toContain(
      "sm:hidden"
    );
  });
});
