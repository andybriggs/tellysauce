import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mocks ----
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { POST } from "./route";

const mockSession = vi.mocked(getServerSession);
const mockStripeCustomersCreate = vi.mocked(stripe.customers.create);
const mockStripeCustomersRetrieve = vi.mocked(stripe.customers.retrieve);
const mockStripeCheckoutCreate = vi.mocked(stripe.checkout.sessions.create);
const mockFindFirst = (db as unknown as { query: { users: { findFirst: ReturnType<typeof vi.fn> } }; update: ReturnType<typeof vi.fn> }).query.users.findFirst;
const mockUpdate = (db as unknown as { query: { users: { findFirst: ReturnType<typeof vi.fn> } }; update: ReturnType<typeof vi.fn> }).update;

beforeEach(() => {
  vi.clearAllMocks();
  // Set up the update chain
  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
});

describe("POST /api/stripe/checkout", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/stripe/checkout", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found in DB", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/stripe/checkout", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("creates a checkout session when user has existing valid Stripe customer", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      stripeCustomerId: "cus_existing",
    });
    mockStripeCustomersRetrieve.mockResolvedValue({ id: "cus_existing", deleted: false } as never);
    mockStripeCheckoutCreate.mockResolvedValue({
      id: "cs_test",
      url: "https://checkout.stripe.com/pay/cs_test",
    } as never);

    const req = new NextRequest("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe("https://checkout.stripe.com/pay/cs_test");
    expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
  });

  it("clears stale customer ID and creates a new one when Stripe returns resource_missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      email: "stale@example.com",
      name: "Stale User",
      stripeCustomerId: "cus_stale_live_id",
    });
    // Simulate Stripe test-mode rejecting a live-mode customer ID
    const stripeError = Object.assign(new Error("No such customer"), { code: "resource_missing" });
    mockStripeCustomersRetrieve.mockRejectedValue(stripeError);
    mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new" } as never);
    mockStripeCheckoutCreate.mockResolvedValue({
      id: "cs_test",
      url: "https://checkout.stripe.com/pay/cs_new",
    } as never);

    const req = new NextRequest("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    // Should have created a fresh customer after the stale one failed
    expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
      email: "stale@example.com",
      name: "Stale User",
      metadata: { userId: "user-1" },
    });
    const data = await res.json();
    expect(data.url).toBe("https://checkout.stripe.com/pay/cs_new");
  });

  it("creates a new Stripe customer when user has none, then creates checkout", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      email: "new@example.com",
      name: "New User",
      stripeCustomerId: null,
    });
    mockStripeCustomersCreate.mockResolvedValue({
      id: "cus_new",
    } as never);
    mockStripeCheckoutCreate.mockResolvedValue({
      id: "cs_test",
      url: "https://checkout.stripe.com/pay/cs_test",
    } as never);

    const req = new NextRequest("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
      email: "new@example.com",
      name: "New User",
      metadata: { userId: "user-1" },
    });
    const data = await res.json();
    expect(data.url).toBe("https://checkout.stripe.com/pay/cs_test");
  });
});
