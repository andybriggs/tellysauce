import { render, screen, act } from "@testing-library/react";
import MobileTopBar from "./MobileTopBar";

function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new Event("scroll"));
  });
}

describe("MobileTopBar", () => {
  beforeEach(() => scrollTo(0));

  it("is transparent at the top of the page", () => {
    render(<MobileTopBar />);
    expect(screen.getByTestId("mobile-top-bar").className).toContain("opacity-0");
  });

  it("fades in once scrolled past the threshold", () => {
    render(<MobileTopBar />);
    scrollTo(200);
    expect(screen.getByTestId("mobile-top-bar").className).toContain("opacity-100");
  });

  it("ignores small rubber-band scrolls", () => {
    render(<MobileTopBar />);
    scrollTo(10);
    expect(screen.getByTestId("mobile-top-bar").className).toContain("opacity-0");
  });

  it("starts opaque when the page loads already scrolled down", () => {
    scrollTo(500);
    render(<MobileTopBar />);
    expect(screen.getByTestId("mobile-top-bar").className).toContain("opacity-100");
  });

  it("sits under the buttons it backs, and only on mobile", () => {
    render(<MobileTopBar />);
    const bar = screen.getByTestId("mobile-top-bar");
    // Buttons are z-40; the bar must not cover them or swallow their clicks.
    expect(bar.className).toContain("z-30");
    expect(bar.className).toContain("pointer-events-none");
    expect(bar.className).toContain("sm:hidden");
  });
});
