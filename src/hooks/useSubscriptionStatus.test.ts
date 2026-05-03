import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";
import { useSubscriptionStatus } from "./useSubscriptionStatus";

const { mockIsLoggedIn } = vi.hoisted(() => ({
  mockIsLoggedIn: vi.fn(() => false),
}));

vi.mock("./useIsLoggedIn", () => ({ default: mockIsLoggedIn }));

describe("useSubscriptionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoggedIn.mockReturnValue(false);
  });

  it("returns null when user is not logged in", () => {
    const { result } = renderHook(() => useSubscriptionStatus());
    expect(result.current).toBeNull();
  });

  it("does not fetch when user is not logged in", () => {
    let fetchCalled = false;
    server.use(
      http.get("/api/subscription-status", () => {
        fetchCalled = true;
        return HttpResponse.json({ subscriptionStatus: "active", freeRecCallsUsed: 0 });
      })
    );

    renderHook(() => useSubscriptionStatus());
    expect(fetchCalled).toBe(false);
  });

  it("fetches and returns subscription status when logged in", async () => {
    mockIsLoggedIn.mockReturnValue(true);
    server.use(
      http.get("/api/subscription-status", () =>
        HttpResponse.json({ subscriptionStatus: "active", freeRecCallsUsed: 2 })
      )
    );

    const { result } = renderHook(() => useSubscriptionStatus());

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.subscriptionStatus).toBe("active");
    expect(result.current?.freeRecCallsUsed).toBe(2);
  });

  it("returns status with null subscriptionStatus for free users", async () => {
    mockIsLoggedIn.mockReturnValue(true);
    server.use(
      http.get("/api/subscription-status", () =>
        HttpResponse.json({ subscriptionStatus: null, freeRecCallsUsed: 1 })
      )
    );

    const { result } = renderHook(() => useSubscriptionStatus());

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.subscriptionStatus).toBeNull();
    expect(result.current?.freeRecCallsUsed).toBe(1);
  });

  it("remains null when the fetch returns a non-OK response", async () => {
    mockIsLoggedIn.mockReturnValue(true);
    server.use(
      http.get("/api/subscription-status", () =>
        HttpResponse.json({}, { status: 500 })
      )
    );

    const { result } = renderHook(() => useSubscriptionStatus());

    // Give it time to settle — should stay null
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBeNull();
  });

  it("remains null when the fetch throws a network error", async () => {
    mockIsLoggedIn.mockReturnValue(true);
    server.use(
      http.get("/api/subscription-status", () => HttpResponse.error())
    );

    const { result } = renderHook(() => useSubscriptionStatus());

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBeNull();
  });
});
