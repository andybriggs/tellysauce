import { NextRequest, NextResponse } from "next/server";

// Paths that scanners probe — short-circuit before a serverless function cold-starts
const SCANNER_PATH =
  /\/\.git|\/\.env|\/wp-|\/phpmyadmin|\/xmlrpc|\.php$|\.asp(x?)$|\/cgi-bin/i;

// Bots that generate Neon compute cost without SEO value
const BLOCKED_UA =
  /AhrefsBot|SemrushBot|MJ12bot|DotBot|BLEXBot|DataForSeoBot|PetalBot|Baiduspider|YandexBot|Bytespider|GPTBot|ClaudeBot|anthropic-ai|CCBot|AwarioBot|magpie-crawler|Omigili|Seekport|NetcraftSurveyAgent/i;

// Legitimate SEO bots — allowed on pages, blocked on /api routes
const SEO_BOT_UA = /Googlebot|Bingbot|Slurp|DuckDuckBot/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") ?? "";
  const host = request.headers.get("host") ?? "";

  // Redirect Vercel preview URLs to the canonical production domain.
  // Cron is exempt: Vercel's scheduler invokes the deployment on its
  // .vercel.app host and does not follow redirects, so redirecting here
  // silently stops the job from ever running. The route authenticates on
  // CRON_SECRET before doing any work, so letting it through is safe.
  if (host.endsWith(".vercel.app") && !pathname.startsWith("/api/cron/")) {
    const url = new URL(request.url);
    url.host = "www.tellysauce.com";
    url.protocol = "https:";
    return NextResponse.redirect(url, 301);
  }

  if (SCANNER_PATH.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  if (BLOCKED_UA.test(ua)) {
    return new NextResponse(null, { status: 403 });
  }

  // SEO bots have no business hitting API routes
  if (pathname.startsWith("/api/") && SEO_BOT_UA.test(ua)) {
    return new NextResponse(null, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
