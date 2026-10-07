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
  it("creates a stacking context, so fixed overlay controls must not be nested inside it", () => {
    // Regression guard: the HeaderMenu burger originally rendered in here and
    // its z-40 was trapped beneath the z-30 MobileTopBar, making it invisible.
    // If this z-index is ever removed the constraint goes away, but while it is
    // here anything fixed and layered above the page has to be a sibling.
    const { container } = render(
      <HeroSection>
        <div>child</div>
      </HeroSection>
    );
    const section = container.querySelector("section");
    expect(section?.className).toContain("relative");
    expect(section?.className).toContain("z-10");
  });
});
