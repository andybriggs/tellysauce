import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { shows } = body;

  if (!Array.isArray(shows) || shows.length === 0) {
    return NextResponse.json({ error: 'No shows provided' }, { status: 400 });
  }

  const prompt = `
You are a TV and film expert. Recommend 5 similar titles based on the user's favorites.
The user's saved titles may be a mix of TV shows and movies, with various genres, languages, and release years.

Return the results as a JSON array in this format:

[
  {
    "title": "string",
    "description": "string",
    "tags": ["TV Show", "Drama", "English", "2023"]
  }
]

Only return raw JSON. Do not include markdown code blocks, explanations, or extra formatting such as \`\`\`json.
`;

  const modelVersion = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${process.env.GOOGLE_GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8 },
        }),
      }
    );

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const joined = (Array.isArray(text) ? text.join('\n') : text).trim();

    // Clean markdown code fences if present
    const cleaned = joined.replace(/```json|```/g, '').trim();

    let recommendations: {
      title: string;
      description: string;
      tags: string[];
    }[] = [];

    try {
      recommendations = JSON.parse(cleaned);
    } catch (err) {
      console.error("Failed to parse Gemini JSON output:", err, "\nRaw response:\n", cleaned);
      return NextResponse.json({ error: 'Invalid JSON format returned by Gemini.' }, { status: 500 });
    }

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}
