import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import HeaderMenu from "./HeaderMenu";

vi.mock("@/components/common/AuthButton", () => ({
  default: () => <div>auth-button</div>,
}));
vi.mock("@/components/common/RegionPicker", () => ({
  default: () => <div>region-picker</div>,
}));

const mockIsLoggedIn = vi.fn(() => true);
vi.mock("@/hooks/useIsLoggedIn", () => ({
  default: () => mockIsLoggedIn(),
}));

const open = () => fireEvent.click(screen.getByTestId("header-menu-button"));

describe("HeaderMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoggedIn.mockReturnValue(true);
  });

  it("keeps the drawer closed until the burger is pressed", () => {
    render(<HeaderMenu isSubscriber={false} onManageSubscription={vi.fn()} />);
    expect(screen.queryByText("Menu")).toBeNull();
    open();
    expect(screen.getByText("Menu")).toBeInTheDocument();
  });

  it("collapses the region picker and account controls into the drawer", () => {
    render(<HeaderMenu isSubscriber={false} onManageSubscription={vi.fn()} />);
    open();
    expect(screen.getByText("region-picker")).toBeInTheDocument();
    expect(screen.getByText("auth-button")).toBeInTheDocument();
  });

  it("only offers subscription management to subscribers", () => {
    const { rerender } = render(
      <HeaderMenu isSubscriber={false} onManageSubscription={vi.fn()} />
    );
    open();
    expect(screen.queryByText(/Pro · Manage/)).toBeNull();

    fireEvent.click(screen.getByLabelText("Close"));
    rerender(<HeaderMenu isSubscriber onManageSubscription={vi.fn()} />);
    open();
    expect(screen.getByText(/Pro · Manage/)).toBeInTheDocument();
  });

  it("closes the drawer when managing the subscription, so the redirect is not hidden behind it", () => {
    const onManage = vi.fn();
    render(<HeaderMenu isSubscriber onManageSubscription={onManage} />);
    open();
    fireEvent.click(screen.getByText(/Pro · Manage/));
    expect(onManage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Menu")).toBeNull();
  });

  it("is hidden from sm up, where the inline header takes over", () => {
    render(<HeaderMenu isSubscriber={false} onManageSubscription={vi.fn()} />);
    expect(screen.getByTestId("header-menu-button").className).toContain("sm:hidden");
  });
});
