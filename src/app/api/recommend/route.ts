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

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return Response.json(
        { error: "Missing GOOGLE_GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const { shows } = await req.json();
    if (!Array.isArray(shows) || shows.length === 0) {
      return Response.json({ error: "No shows provided" }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

    // 1) Make the input tiny (title + rating only, cap at 12)
    const compact = shows.slice(0, 12).map((s: any) => ({
      title: s.title ?? s.name ?? String(s),
      rating: s.rating ?? s.score ?? s.userRating ?? null,
    }));

    // ---------- PASS 1: Grounded (tools ON, JSON mode OFF) ----------
    const groundedPrompt = `
You are a TV/film expert.

User favorites (title::rating), one per line:
${compact.map((s: any) => `${s.title}::${s.rating ?? ""}`).join("\n")}

Task:
- Propose EXACTLY 8 new titles (exclude anything already listed).
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
        thinkingConfig: { thinkingBudget: 0 }, // 0 = off
        maxOutputTokens: 600,
        temperature: 0.6,
        stopSequences: ["<<<END>>>"],
        candidateCount: 1,
      },
    });

    // Extract text robustly (response.text can be empty even when parts have text)
    const parts = groundedRes?.candidates?.[0]?.content?.parts ?? [];
    const raw = parts

      .map((p: any) => (typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim();
    const endIdx = raw.indexOf("<<<END>>>");
    const groundedText = (endIdx >= 0 ? raw.slice(0, endIdx) : raw).trim();

    const finish = groundedRes.candidates?.[0]?.finishReason ?? null;
    const block = groundedRes.promptFeedback?.blockReason ?? null;

    if (!groundedText) {
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

    // ---------- PASS 2: Structuring (tools OFF, JSON mode ON) ----------
    const structuringRes = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL_STRUCT || "gemini-2.5-flash-lite",
      contents: `
Turn the following lines into STRICT JSON.

Rules:
- Output ONLY JSON (no prose, no code fences).
- Each item: { "title", "description", "reason", "tags": [strings] }.
- Keep descriptions concise; normalize tags to short labels (genres/language/year).
- Return exactly 8 items.

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

    // NOTE: you had `${text}` here; that variable doesn't exist. Use groundedText above.
    const recommendations: Rec[] = JSON.parse(structuringRes.text || "[]");
    return Response.json({ recommendations });
  } catch (err) {
    console.error("Recommend route error:", err);
    return Response.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
