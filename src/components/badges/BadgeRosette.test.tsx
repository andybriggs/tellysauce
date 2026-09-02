import { render, screen } from "@testing-library/react";
import BadgeRosette from "./BadgeRosette";

describe("BadgeRosette", () => {
  it("renders the tier numeral", () => {
    for (const tier of [1, 2, 3, 4, 5] as const) {
      const { unmount } = render(<BadgeRosette tier={tier} />);
      expect(screen.getByText(String(tier))).toBeInTheDocument();
      unmount();
    }
  });

  it("renders 12 petals", () => {
    render(<BadgeRosette tier={1} />);
    expect(screen.getAllByTestId("rosette-petal")).toHaveLength(12);
  });

  it("renders at full opacity when earned", () => {
    const { container } = render(<BadgeRosette tier={3} earned />);
    expect(container.querySelector("svg")).not.toHaveStyle({ opacity: "0.45" });
  });

  it("dims unearned badges", () => {
    const { container } = render(<BadgeRosette tier={3} earned={false} />);
    expect(container.querySelector("svg")).toHaveStyle({ opacity: "0.45" });
  });

  it("uses a gradient for tier 5 only", () => {
    const { container: five } = render(<BadgeRosette tier={5} />);
    expect(five.querySelector("linearGradient")).toBeInTheDocument();

    const { container: three } = render(<BadgeRosette tier={3} />);
    expect(three.querySelector("linearGradient")).not.toBeInTheDocument();
  });

  it("drops the gradient when tier 5 is locked", () => {
    const { container } = render(<BadgeRosette tier={5} earned={false} />);
    expect(container.querySelector("linearGradient")).not.toBeInTheDocument();
  });

  it("gives each tier-5 instance its own gradient id", () => {
    const { container } = render(
      <>
        <BadgeRosette tier={5} />
        <BadgeRosette tier={5} />
      </>
    );
    const ids = Array.from(container.querySelectorAll("linearGradient")).map(
      (g) => g.id
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("omits the numeral when showNumber is false", () => {
    render(<BadgeRosette tier={3} showNumber={false} />);
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("still renders the rosette body without a numeral", () => {
    render(<BadgeRosette tier={3} showNumber={false} />);
    expect(screen.getAllByTestId("rosette-petal")).toHaveLength(12);
  });

  it("honours the size prop", () => {
    const { container } = render(<BadgeRosette tier={1} size={72} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "72");
  });
});
