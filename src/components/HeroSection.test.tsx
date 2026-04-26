import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import HeroSection from "./HeroSection";

// rAF runs synchronously in tests so background position updates are immediate
beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HeroSection", () => {
  it("renders children", () => {
    render(<HeroSection><p>Hello world</p></HeroSection>);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders a section element", () => {
    const { container } = render(<HeroSection><span /></HeroSection>);
    expect(container.querySelector("section")).toBeInTheDocument();
  });

  it("renders the background pattern div", () => {
    const { container } = render(<HeroSection><span /></HeroSection>);
    const bg = container.querySelector("[class*=\"bg-\\\\[url\"]") ??
      Array.from(container.querySelectorAll("div")).find((el) =>
        el.className.includes("bg-[url")
      );
    expect(bg).toBeInTheDocument();
  });

  it("renders the gradient overlay div", () => {
    const { container } = render(<HeroSection><span /></HeroSection>);
    const overlay = Array.from(container.querySelectorAll("div")).find((el) =>
      el.className.includes("bg-gradient-to-r")
    );
    expect(overlay).toBeInTheDocument();
  });

  it("adds a scroll listener on mount and removes it on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(<HeroSection><span /></HeroSection>);
    expect(addSpy).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });

  it("updates background position on mouse move", () => {
    const { container } = render(<HeroSection><span /></HeroSection>);
    const section = container.querySelector("section") as HTMLElement;

    // Mock getBoundingClientRect so we have a known centre
    section.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, width: 1000, height: 400,
      right: 1000, bottom: 400, x: 0, y: 0, toJSON: () => {},
    }));

    act(() => {
      fireEvent.mouseMove(section, { clientX: 600, clientY: 250 });
    });

    const bgDiv = Array.from(container.querySelectorAll("div")).find((el) =>
      el.className.includes("bg-[url")
    ) as HTMLElement;

    // clientX 600, centreX 500 → offset 100 * 0.03 = 3px
    // clientY 250, centreY 200 → offset 50 * 0.03 = 1.5px
    expect(bgDiv.style.backgroundPosition).toBe("3px 1.5px");
  });

  it("updates background position on scroll", () => {
    const { container } = render(<HeroSection><span /></HeroSection>);

    act(() => {
      Object.defineProperty(window, "scrollY", { value: 200, configurable: true });
      fireEvent.scroll(window);
    });

    const bgDiv = Array.from(container.querySelectorAll("div")).find((el) =>
      el.className.includes("bg-[url")
    ) as HTMLElement;

    // scrollY 200 * 0.25 = 50, mouse offsets still 0
    expect(bgDiv.style.backgroundPosition).toBe("0px 50px");
  });
});
