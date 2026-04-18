import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mocks ----
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    billingPortal: {
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
  },
}));

import { getServerSession } from "next-auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { POST } from "./route";

const mockSession = vi.mocked(getServerSession);
const mockPortalCreate = vi.mocked(stripe.billingPortal.sessions.create);
const mockFindFirst = (db as unknown as { query: { users: { findFirst: ReturnType<typeof vi.fn> } } }).query.users.findFirst;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/stripe/portal", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/stripe/portal", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 404 when user has no Stripe customer", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({ id: "user-1", stripeCustomerId: null });

    const req = new NextRequest("http://localhost/api/stripe/portal", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("No subscription found");
  });

  it("returns 404 when user not found in DB", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/stripe/portal", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("creates portal session and returns URL", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindFirst.mockResolvedValue({
      id: "user-1",
      stripeCustomerId: "cus_existing",
    });
    mockPortalCreate.mockResolvedValue({
      id: "bps_test",
      url: "https://billing.stripe.com/session/bps_test",
    } as never);

    const req = new NextRequest("http://localhost/api/stripe/portal", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe("https://billing.stripe.com/session/bps_test");
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_existing",
      return_url: "http://localhost:3000/",
    });
  });
});
