import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import useIsLoggedIn from "./useIsLoggedIn";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

import { useSession } from "next-auth/react";

describe("useIsLoggedIn", () => {
  it("returns false when status is unauthenticated", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });

    const { result } = renderHook(() => useIsLoggedIn());
    expect(result.current).toBe(false);
  });

  it("returns false when status is loading", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "loading",
      update: vi.fn(),
    });

    const { result } = renderHook(() => useIsLoggedIn());
    expect(result.current).toBe(false);
  });

  it("returns true when status is authenticated", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1", name: "Test User", email: "test@example.com" }, expires: "2099-01-01" },
      status: "authenticated",
      update: vi.fn(),
    });

    const { result } = renderHook(() => useIsLoggedIn());
    expect(result.current).toBe(true);
  });

  it("returns true when session has user data", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-42", name: "Andy", email: "andy@example.com" }, expires: "2099-12-31" },
      status: "authenticated",
      update: vi.fn(),
    });

    const { result } = renderHook(() => useIsLoggedIn());
    expect(result.current).toBe(true);
  });
});
