import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mocks ----
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/server/titleStore", () => ({
  getRating: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getRating } from "@/server/titleStore";
import { GET } from "./route";

const mockSession = vi.mocked(getServerSession);
const mockGetRating = vi.mocked(getRating);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/rating", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/rating?tmdbId=550&mediaType=movie");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns rating for a title", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetRating.mockResolvedValue(4);

    const req = new NextRequest("http://localhost/api/rating?tmdbId=550&mediaType=movie");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rating).toBe(4);
    expect(mockGetRating).toHaveBeenCalledWith("user-1", 550, "movie");
  });

  it("defaults mediaType to tv when not provided", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetRating.mockResolvedValue(0);

    const req = new NextRequest("http://localhost/api/rating?tmdbId=1234");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetRating).toHaveBeenCalledWith("user-1", 1234, "tv");
  });

  it("returns 0 when no rating exists", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetRating.mockResolvedValue(0);

    const req = new NextRequest("http://localhost/api/rating?tmdbId=9999&mediaType=tv");
    const res = await GET(req);
    const data = await res.json();
    expect(data.rating).toBe(0);
  });
});
