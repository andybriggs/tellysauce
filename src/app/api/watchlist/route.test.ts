import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mocks ----
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/server/titleStore", () => ({
  getWatchlist: vi.fn(),
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "@/server/titleStore";
import { GET, POST, DELETE } from "./route";

const mockSession = vi.mocked(getServerSession);
const mockGetWatchlist = vi.mocked(getWatchlist);
const mockAddToWatchlist = vi.mocked(addToWatchlist);
const mockRemoveFromWatchlist = vi.mocked(removeFromWatchlist);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/watchlist", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns watchlist for authenticated user", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } } as never);
    const fakeList = [{ id: 1, type: "movie", name: "Fight Club", poster: null, year: 1999, description: null }];
    mockGetWatchlist.mockResolvedValue(fakeList as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(fakeList);
    expect(mockGetWatchlist).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/watchlist", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ tmdbId: 550, mediaType: "movie" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when tmdbId or mediaType missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);

    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ tmdbId: 550 }), // missing mediaType
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("adds item to watchlist and returns ok:true", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockAddToWatchlist.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ tmdbId: 550, mediaType: "movie" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockAddToWatchlist).toHaveBeenCalledWith("user-1", 550, "movie");
  });
});

describe("DELETE /api/watchlist", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "DELETE",
      body: JSON.stringify({ tmdbId: 550, mediaType: "movie" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("removes item from watchlist and returns ok:true", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockRemoveFromWatchlist.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/watchlist", {
      method: "DELETE",
      body: JSON.stringify({ tmdbId: 550, mediaType: "movie" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockRemoveFromWatchlist).toHaveBeenCalledWith("user-1", 550, "movie");
  });
});
