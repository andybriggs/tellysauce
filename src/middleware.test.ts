import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function req(pathname: string, ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0") {
  return new NextRequest(`https://tellysauce.co.uk${pathname}`, {
    headers: { "user-agent": ua },
  });
}

function previewReq(pathname: string) {
  return new NextRequest(`https://tellysauce-abc123.vercel.app${pathname}`, {
    headers: { host: "tellysauce-abc123.vercel.app" },
  });
}

describe("middleware", () => {
  describe("host handling", () => {
    // A .vercel.app -> canonical domain redirect used to live here. It caught
    // Vercel's cron scheduler, which invokes the deployment on its .vercel.app
    // host and does not follow redirects, silently killing the daily job. The
    // middleware must not redirect on host.
    it("does not redirect requests on the .vercel.app host", () => {
      expect(middleware(previewReq("/title/tv/12345")).status).toBe(200);
    });

    it("lets cron through on the .vercel.app host", () => {
      expect(middleware(previewReq("/api/cron/ai-popular")).status).toBe(200);
    });
  });

  describe("scanner path blocking", () => {
    it.each([
      "/.git/config",
      "/www/.git/config",
      "/.env",
      "/.env.local",
      "/wp-admin/login.php",
      "/wp-login.php",
      "/phpmyadmin/index.php",
      "/xmlrpc.php",
      "/index.php",
      "/shell.asp",
      "/upload.aspx",
      "/cgi-bin/test",
    ])("returns 404 for %s", (pathname) => {
      expect(middleware(req(pathname)).status).toBe(404);
    });
  });

  describe("blocked bot user-agents", () => {
    it.each([
      "AhrefsBot/7.0 (+http://ahrefs.com/robot/)",
      "SemrushBot/7~bl (+https://www.semrush.com/bot.html)",
      "MJ12bot/v1.4.8 (http://mj12bot.com/)",
      "DotBot/1.2 (https://opensiteexplorer.org/dotbot)",
      "BLEXBot/1.0",
      "DataForSeoBot/1.0",
      "PetalBot (+https://aspiegel.com/petalbot)",
      "Baiduspider/2.0",
      "YandexBot/3.0",
      "Bytespider; compatible; +https://zhanzhang.toutiao.com/",
      "GPTBot/1.0 (+https://openai.com/gptbot)",
      "ClaudeBot/1.0",
      "CCBot/2.0 (https://commoncrawl.org/faq/)",
    ])("blocks '%s' with 403", (ua) => {
      expect(middleware(req("/", ua)).status).toBe(403);
    });
  });

  describe("SEO bot handling", () => {
    const googlebotUa = "Googlebot/2.1 (+http://www.google.com/bot.html)";
    const bingbotUa = "Bingbot/2.0";

    it("blocks Googlebot on /api routes", () => {
      expect(middleware(req("/api/discover", googlebotUa)).status).toBe(403);
    });

    it("blocks Bingbot on /api routes", () => {
      expect(middleware(req("/api/watchlist", bingbotUa)).status).toBe(403);
    });

    it("allows Googlebot on page routes", () => {
      expect(middleware(req("/", googlebotUa)).status).toBe(200);
    });

    it("allows Googlebot on title pages", () => {
      expect(middleware(req("/title/tv/12345", googlebotUa)).status).toBe(200);
    });
  });

  describe("legitimate traffic", () => {
    it("passes normal browser requests through", () => {
      expect(middleware(req("/")).status).toBe(200);
    });

    it("passes title page requests through", () => {
      expect(middleware(req("/title/movie/123")).status).toBe(200);
    });

    it("passes API requests from normal browser through", () => {
      expect(middleware(req("/api/discover")).status).toBe(200);
    });

    it("passes requests with no user-agent through", () => {
      const bare = new NextRequest("https://tellysauce.co.uk/");
      expect(middleware(bare).status).toBe(200);
    });

    it("passes pricing page through", () => {
      expect(middleware(req("/pricing")).status).toBe(200);
    });
  });
});
