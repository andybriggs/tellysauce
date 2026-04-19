export async function fetchIMDbRating(
  imdbId: string,
  revalidate: number
): Promise<string | null> {
  const key = process.env.OMDB_API_KEY;
  if (!key) return null;
  const res = await fetch(
    `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${key}`,
    { next: { revalidate } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.Response === "False") return null;
  return data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null;
}
