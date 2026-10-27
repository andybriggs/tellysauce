import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi } from "vitest";
import BackToTopButton from "./BackToTopButton";

vi.mock("@heroicons/react/24/solid", () => ({
  ChevronUpIcon: () => <svg data-testid="chevron-up" />,
}));

function scrollTo(y: number) {
  window.scrollY = y;
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

describe("BackToTopButton", () => {
  beforeEach(() => {
    window.scrollY = 0;
  });

  it("stays hidden near the top of the page", () => {
    render(<BackToTopButton />);
    expect(screen.queryByTestId("back-to-top")).toBeNull();
  });

  it("appears once the page is scrolled", () => {
    render(<BackToTopButton />);
    scrollTo(800);
    expect(screen.getByTestId("back-to-top")).toBeInTheDocument();
  });

  it("hides again when scrolled back up", () => {
    render(<BackToTopButton />);
    scrollTo(800);
    scrollTo(0);
    expect(screen.queryByTestId("back-to-top")).toBeNull();
  });

  it("starts visible when the page loads part-way down", () => {
    window.scrollY = 800;
    render(<BackToTopButton />);
    expect(screen.getByTestId("back-to-top")).toBeInTheDocument();
  });

  it("scrolls to the top when pressed", () => {
    const scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo;
    render(<BackToTopButton />);
    scrollTo(800);
    fireEvent.click(screen.getByTestId("back-to-top"));
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
