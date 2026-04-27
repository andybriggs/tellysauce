import { render, screen } from "@testing-library/react";
import HeroSection from "./HeroSection";

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
    const bg = Array.from(container.querySelectorAll("div")).find((el) =>
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
});
