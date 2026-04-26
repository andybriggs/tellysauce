export async function fetchIMDbRating(
  imdbId: string,
  revalidate: number
): Promise<{ imdbRating: string | null; rtRating: string | null }> {
  const key = process.env.OMDB_API_KEY;
  if (!key) return { imdbRating: null, rtRating: null };
  const res = await fetch(
    `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${key}`,
    { next: { revalidate } }
  );
  if (!res.ok) return { imdbRating: null, rtRating: null };
  const data = await res.json();
  if (data.Response === "False") return { imdbRating: null, rtRating: null };

  const imdbRating =
    data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null;

  const rtEntry = (data.Ratings ?? []).find(
    (r: { Source: string; Value: string }) => r.Source === "Rotten Tomatoes"
  );
  const rtRating = rtEntry?.Value ?? null;

  return { imdbRating, rtRating };
}
