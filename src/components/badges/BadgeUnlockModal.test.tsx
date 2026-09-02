import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import BadgeUnlockModal from "./BadgeUnlockModal";

// The Lottie player pulls in a WASM-free but heavy renderer; stub it out.
vi.mock("./BadgeCelebration", () => ({
  default: () => <div data-testid="badge-celebration" />,
}));

describe("BadgeUnlockModal", () => {
  it("renders the badge name and unlock text", () => {
    render(<BadgeUnlockModal badgeKey="rated_5" onClose={vi.fn()} />);
    expect(screen.getByText("Star Struck")).toBeInTheDocument();
    expect(screen.getByText(/first opinions, on the record/i)).toBeInTheDocument();
  });

  it("renders the rosette for the badge's tier", () => {
    render(<BadgeUnlockModal badgeKey="rated_30" onClose={vi.fn()} />);
    // rated_30 is tier 3
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("plays the celebration animation", () => {
    render(<BadgeUnlockModal badgeKey="rated_5" onClose={vi.fn()} />);
    expect(screen.getByTestId("badge-celebration")).toBeInTheDocument();
  });

  it("renders nothing for an unknown badge key", () => {
    render(<BadgeUnlockModal badgeKey="not_a_badge" onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onClose from the dismiss button", () => {
    const onClose = vi.fn();
    render(<BadgeUnlockModal badgeKey="rated_5" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Nice!" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose from the X button", () => {
    const onClose = vi.fn();
    render(<BadgeUnlockModal badgeKey="rated_5" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a Next button and a counter when more badges are queued", () => {
    render(
      <BadgeUnlockModal
        badgeKey="rated_5"
        onClose={vi.fn()}
        position={1}
        total={3}
      />
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("shows no counter for a single badge", () => {
    render(<BadgeUnlockModal badgeKey="rated_5" onClose={vi.fn()} />);
    expect(screen.queryByText(/^\d+ of \d+$/)).not.toBeInTheDocument();
  });
});
