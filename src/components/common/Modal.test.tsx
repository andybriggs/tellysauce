import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        <p>Body</p>
      </Modal>
    );
    expect(screen.queryByText("Body")).not.toBeInTheDocument();
  });

  it("renders into a portal on document.body", () => {
    const { container } = render(
      <Modal open onClose={vi.fn()}>
        <p>Body</p>
      </Modal>
    );
    // Portalled, so nothing lands in the render container
    expect(container.firstChild).toBeNull();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("exposes dialog semantics", () => {
    render(
      <Modal open onClose={vi.fn()} labelledBy="t">
        <h2 id="t">Title</h2>
      </Modal>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "t");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>Body</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>Body</p>
      </Modal>
    );
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the panel itself is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>Body</p>
      </Modal>
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks body scroll while open and restores it on close", () => {
    const { unmount } = render(
      <Modal open onClose={vi.fn()}>
        <p>Body</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("sits above the app's z-50 ceiling", () => {
    render(
      <Modal open onClose={vi.fn()}>
        <p>Body</p>
      </Modal>
    );
    expect(screen.getByTestId("modal-backdrop").className).toContain("z-[60]");
  });
});

describe("Modal - drawer variant", () => {
  it("right-aligns the panel", () => {
    render(
      <Modal open onClose={vi.fn()} variant="drawer">
        <p>Body</p>
      </Modal>
    );
    expect(screen.getByTestId("modal-backdrop").className).toContain(
      "justify-end"
    );
  });

  it("renders a full-height panel", () => {
    render(
      <Modal open onClose={vi.fn()} variant="drawer">
        <p>Body</p>
      </Modal>
    );
    expect(screen.getByRole("dialog").className).toContain("h-full");
  });

  it("still closes on Escape and backdrop click", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} variant="drawer">
        <p>Body</p>
      </Modal>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("honours reduced motion on the slide-in", () => {
    render(
      <Modal open onClose={vi.fn()} variant="drawer">
        <p>Body</p>
      </Modal>
    );
    expect(screen.getByRole("dialog").className).toContain(
      "motion-reduce:animate-none"
    );
  });
});
