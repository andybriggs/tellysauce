/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

type Rec = {
  title: string;
  description: string;
  reason: string;
  tags: string[];
};

function slugTitle(raw: string) {
  if (!raw) return "";
  // remove year in parens or at end
  let s = raw.replace(/\(\s*\d{4}\s*\)/g, "").replace(/\b\d{4}\b/g, "");
  // cut subtitles after ":" or "-" if present (keeps main name)
  s = s.split(":")[0].split(" - ")[0];
  // normalize
  s = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ") // drop leading articles
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

function makeForbiddenSet(input: any[]): Set<string> {
  const set = new Set<string>();
  for (const item of input ?? []) {
    const t =
      item?.title ?? item?.name ?? (typeof item === "string" ? item : "") ?? "";
    const slug = slugTitle(String(t));
    if (slug) set.add(slug);
    // also add a couple of relaxed variants to be safer
    if (slug.includes("season"))
      set.add(slug.replace(/\bseason\s+\d+\b/, "").trim());
  }
  return set;
}

function uniqueAllowedLines(lines: string[], forbidden: Set<string>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const title = line.split("|")[0]?.trim() || "";
    const slug = slugTitle(title);
    if (!slug) continue;
    if (forbidden.has(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(line);
  }
  return out;
}

function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^<<<END>>>$/.test(l));
}

async function structureToJson(
  ai: GoogleGenAI,
  groundedText: string
): Promise<Rec[]> {
  const structuringRes = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL_STRUCT || "gemini-2.5-flash-lite",
    contents: `
Turn the following lines into STRICT JSON.

Rules:
- Output ONLY JSON (no prose, no code fences).
- Each item: { "title", "description", "reason", "tags": [strings] }.
- Keep descriptions concise; normalize tags to short labels (genres/language/year).
- Return exactly ${Math.min(
      8,
      groundedText.split("\n").filter(Boolean).length
    )} items.

SOURCE:
${groundedText}
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            reason: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["title", "description", "reason", "tags"],
          additionalProperties: false,
        },
      },
      temperature: 0.2,
      maxOutputTokens: 700,
    },
  });

  const txt = (structuringRes as any)?.text ?? "[]";
  let parsed: any;
  try {
    parsed = JSON.parse(txt);
  } catch {
    parsed = [];
  }
  // sanitize fields minimally
  return (Array.isArray(parsed) ? parsed : [])
    .map((r) => ({
      title: String(r?.title ?? "").trim(),
      description: String(r?.description ?? "").trim(),
      reason: String(r?.reason ?? "").trim(),
      tags: Array.isArray(r?.tags) ? r.tags.map((t: any) => String(t)) : [],
    }))
    .filter((r) => r.title);
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return Response.json(
        { error: "Missing GOOGLE_GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const { titles, watchList } = await req.json();
    if (!Array.isArray(titles) || titles.length === 0) {
      return Response.json({ error: "No titles provided" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

    // Build forbidden set from ALL favorites + ALL watchlist
    const forbidden = makeForbiddenSet([
      ...(titles ?? []),
      ...(watchList ?? []),
    ]);

    // Keep the compact list (only for preference weighting), but do NOT rely on it to exclude
    const compact = titles.slice(0, 12).map((s: any) => ({
      title: s?.title ?? s?.name ?? String(s),
      rating: s?.rating ?? s?.score ?? s?.userRating ?? null,
    }));

    const watchListLines =
      Array.isArray(watchList) && watchList.length > 0
        ? watchList.map((w: any) => `- ${w?.title ?? w?.name ?? w}`).join("\n")
        : "(none provided)";

    // ---------- PASS 1: Grounded (tools ON, JSON mode OFF) ----------
    const groundedPrompt = `
You are a TV/film expert.

User favorites (title::rating), one per line:
${compact.map((s: any) => `${s.title}::${s.rating ?? ""}`).join("\n")}

User watchlist (titles to avoid):
${watchListLines}

Task:
- Propose EXACTLY 8 new titles.
- DO NOT include titles that are already in the users favourite titles list OR watchlist.
- Weight toward higher-rated favorites.
- Use web search to check for latest titles and reviews.
- Output ONE line per item, NO preamble/numbering/URLs.
- END output with: <<<END>>>

FORMAT:
Title | desc (<=10 words) | reason (<=5 words) | tag1, tag2, tag3, tag4
`;

    const groundedRes = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL_GROUNDED || "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: groundedPrompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseModalities: ["TEXT"],
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 600,
        temperature: 0.6,
        stopSequences: ["<<<END>>>"],
        candidateCount: 1,
      },
    });

    const parts = (groundedRes as any)?.candidates?.[0]?.content?.parts ?? [];
    const raw = parts
      .map((p: any) => (typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim();
    const endIdx = raw.indexOf("<<<END>>>");
    const groundedAll = (endIdx >= 0 ? raw.slice(0, endIdx) : raw).trim();

    if (!groundedAll) {
      const finish =
        (groundedRes as any)?.candidates?.[0]?.finishReason ?? null;
      const block = (groundedRes as any)?.promptFeedback?.blockReason ?? null;
      console.error("GROUNDING DEBUG:", {
        finishReason: finish,
        blockReason: block,
        partsCount: parts.length,
      });
      return Response.json(
        {
          error: "Grounded generation failed (empty response)",
          finishReason: finish,
          blockReason: block,
        },
        { status: 502 }
      );
    }

    // Filter lines against forbidden + de-dupe
    const filteredLines = uniqueAllowedLines(
      parseLines(groundedAll),
      forbidden
    );

    // If not enough lines survive, attempt up to 3 quick “repair” passes
    const kept = filteredLines.slice(0, 8);
    let attempts = 0;

    while (kept.length < 8 && attempts < 3) {
      attempts++;
      const haveSlugs = new Set(
        kept.map((l) => slugTitle(l.split("|")[0].trim()))
      );
      // Expand forbidden with what we already kept (to force new ones)
      const expandedForbidden = new Set([...forbidden, ...haveSlugs]);
      const repairPrompt = `
You previously proposed some titles. I need NEW ones that are not in this forbidden list.

Forbidden slugs (normalized):
${Array.from(expandedForbidden).join(", ")}

Task:
- Propose ${8 - kept.length} ADDITIONAL titles only.
- No duplicates of each other or of prior suggestions.
- Output ONE line per item, same format as before.
- END with <<<END>>>

FORMAT:
Title | desc (<=10 words) | reason (<=5 words) | tag1, tag2, tag3, tag4
`;

      const repairRes = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL_GROUNDED || "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: repairPrompt }] }],
        config: {
          tools: [{ googleSearch: {} }],
          responseModalities: ["TEXT"],
          maxOutputTokens: 300,
          temperature: 0.7,
          stopSequences: ["<<<END>>>"],
          candidateCount: 1,
        },
      });

      const rparts = (repairRes as any)?.candidates?.[0]?.content?.parts ?? [];
      const rraw = rparts
        .map((p: any) => p.text ?? "")
        .join("")
        .trim();
      const rendIdx = rraw.indexOf("<<<END>>>");
      const repairText = (rendIdx >= 0 ? rraw.slice(0, rendIdx) : rraw).trim();

      const newLines = uniqueAllowedLines(
        parseLines(repairText),
        expandedForbidden
      );
      // also protect against duping with kept
      const keptSlugs = new Set(
        kept.map((l) => slugTitle(l.split("|")[0].trim()))
      );
      for (const nl of newLines) {
        const s = slugTitle(nl.split("|")[0].trim());
        if (!keptSlugs.has(s)) {
          kept.push(nl);
          keptSlugs.add(s);
          if (kept.length === 8) break;
        }
      }
    }

    // Structure whatever we have (up to 8)
    const groundedText = kept.slice(0, 8).join("\n");
    let recommendations: Rec[] = await structureToJson(ai, groundedText);

    // Final safety net: remove any items that still collide, de-dupe, and top up via another repair if needed
    const finalSeen = new Set<string>();
    recommendations = recommendations.filter((r) => {
      const s = slugTitle(r.title);
      if (!s || forbidden.has(s) || finalSeen.has(s)) return false;
      finalSeen.add(s);
      return true;
    });

    if (recommendations.length < 8) {
      // last quick top-up with a strict JSON request
      const needed = 8 - recommendations.length;
      const strictTopUp = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL_STRUCT || "gemini-2.5-flash-lite",
        contents: `
Suggest ${needed} NEW titles as JSON ONLY that are NOT in this forbidden list.

Forbidden slugs:
${Array.from(new Set([...forbidden, ...finalSeen])).join(", ")}

Each item: { "title", "description", "reason", "tags": [strings] }.
Keep it concise. No duplicates. No forbidden items.
`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                reason: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["title", "description", "reason", "tags"],
              additionalProperties: false,
            },
          },
          temperature: 0.4,
          maxOutputTokens: 400,
        },
      });

      const topTxt = (strictTopUp as any)?.text ?? "[]";
      let top: Rec[] = [];
      try {
        top = JSON.parse(topTxt);
      } catch {
        top = [];
      }

      for (const r of top) {
        const s = slugTitle(r.title);
        if (!s || finalSeen.has(s) || forbidden.has(s)) continue;
        finalSeen.add(s);
        recommendations.push({
          title: String(r.title).trim(),
          description: String(r.description ?? "").trim(),
          reason: String(r.reason ?? "").trim(),
          tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
        });
        if (recommendations.length === 8) break;
      }
    }

    return Response.json({ recommendations });
  } catch (err) {
    console.error("Recommend route error:", err);
    return Response.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
