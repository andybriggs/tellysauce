import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mocks ----
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/server/titleStore", () => ({
  getRated: vi.fn(),
  rateTitle: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getRated, rateTitle } from "@/server/titleStore";
import { GET, POST } from "./route";

const mockSession = vi.mocked(getServerSession);
const mockGetRated = vi.mocked(getRated);
const mockRateTitle = vi.mocked(rateTitle);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/rated", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns rated titles for authenticated user", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const fakeRated = [
      { id: 550, type: "movie", name: "Fight Club", poster: null, year: 1999, description: null, rating: 5 },
    ];
    mockGetRated.mockResolvedValue(fakeRated as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(fakeRated);
    expect(mockGetRated).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/rated", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/rated", {
      method: "POST",
      body: JSON.stringify({ tmdbId: 550, mediaType: "movie", rating: 4 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);

    const req = new NextRequest("http://localhost/api/rated", {
      method: "POST",
      body: JSON.stringify({ tmdbId: 550, mediaType: "movie" }), // missing rating
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when rating is not a number", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);

    const req = new NextRequest("http://localhost/api/rated", {
      method: "POST",
      body: JSON.stringify({ tmdbId: 550, mediaType: "movie", rating: "five" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("submits rating and returns ok:true", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockRateTitle.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/rated", {
      method: "POST",
      body: JSON.stringify({ tmdbId: 550, mediaType: "movie", rating: 4 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockRateTitle).toHaveBeenCalledWith("user-1", 550, "movie", 4);
  });
});
