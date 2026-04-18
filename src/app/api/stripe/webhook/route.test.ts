import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mocks ----
vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

vi.mock("@/db", () => ({
  db: {
    execute: vi.fn().mockResolvedValue(undefined),
  },
}));

import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { POST } from "./route";

const mockConstructEvent = vi.mocked(stripe.webhooks.constructEvent);
const mockDbExecute = vi.mocked(db.execute);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  mockDbExecute.mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function makeWebhookRequest(body: string, sig = "t=1,v1=abc") {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": sig,
    },
  });
}

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Missing stripe-signature/);
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const req = makeWebhookRequest("{}", "bad-sig");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid signature");
  });

  it("handles customer.subscription.created event", async () => {
    const sub = {
      id: "sub_123",
      customer: "cus_abc",
      status: "active",
      items: { data: [{ current_period_end: 1700000000 }] },
    };

    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.created",
      data: { object: sub },
    } as never);

    const req = makeWebhookRequest(JSON.stringify(sub));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
    expect(mockDbExecute).toHaveBeenCalledOnce();
    // Verify the SQL updates the right customer
    const sqlArg = mockDbExecute.mock.calls[0][0];
    expect(JSON.stringify(sqlArg)).toContain("cus_abc");
  });

  it("handles customer.subscription.updated event", async () => {
    const sub = {
      id: "sub_123",
      customer: "cus_abc",
      status: "past_due",
      items: { data: [{ current_period_end: 1700000000 }] },
    };

    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: sub },
    } as never);

    const req = makeWebhookRequest(JSON.stringify(sub));
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockDbExecute).toHaveBeenCalledOnce();
  });

  it("handles customer.subscription.deleted event", async () => {
    const sub = {
      id: "sub_123",
      customer: "cus_abc",
      status: "canceled",
      items: { data: [] },
    };

    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: sub },
    } as never);

    const req = makeWebhookRequest(JSON.stringify(sub));
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockDbExecute).toHaveBeenCalledOnce();
    const sqlArg = mockDbExecute.mock.calls[0][0];
    expect(JSON.stringify(sqlArg)).toContain("canceled");
  });

  it("handles invoice.payment_failed event", async () => {
    const invoice = {
      id: "in_123",
      customer: "cus_abc",
    };

    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: { object: invoice },
    } as never);

    const req = makeWebhookRequest(JSON.stringify(invoice));
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockDbExecute).toHaveBeenCalledOnce();
    const sqlArg = mockDbExecute.mock.calls[0][0];
    expect(JSON.stringify(sqlArg)).toContain("past_due");
  });

  it("returns 200 for unhandled event types (no-op)", async () => {
    mockConstructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: {} },
    } as never);

    const req = makeWebhookRequest("{}");
    const res = await POST(req);
    expect(res.status).toBe(200);
    // No DB calls for unhandled events
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it("returns 500 when DB update throws", async () => {
    const sub = {
      id: "sub_123",
      customer: "cus_abc",
      status: "active",
      items: { data: [{ current_period_end: 1700000000 }] },
    };

    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.created",
      data: { object: sub },
    } as never);

    mockDbExecute.mockRejectedValue(new Error("DB connection failed"));

    const req = makeWebhookRequest(JSON.stringify(sub));
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
