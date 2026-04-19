export type MediaType = "movie" | "tv";

export interface TitleDetails {
  id: number;
  title: string;
  original_title?: string;
  plot_overview?: string;
  type?: MediaType;
  runtime_minutes?: number | null;
  year?: number;
  end_year?: number | null;
  release_date?: string;
  imdb_id?: string | null;
  tmdb_id?: number | null;
  tmdb_type?: MediaType | null;
  genres?: number[];
  genre_names?: string[];
  critic_score?: number | null; // always null
  tmdb_vote_average?: number | null;
  tmdb_vote_count?: number | null;
  us_rating?: string | null;
  poster?: string | null;
  posterMedium?: string | null;
  posterLarge?: string | null;
  backdrop?: string | null;
  original_language?: string | null;
  network_names?: string[];
  trailerKey?: string | null;
}

export interface TitleSource {
  source_id: number;
  name: string;
  type: "sub" | "rent" | "buy" | "free" | "ads";
  region: string;
  icon: string;
  ios_url?: string | null;
  android_url?: string | null;
  web_url?: string | null;
  format?: string | null;
  price?: number | null;
  seasons?: unknown;
  episodes?: unknown;
}
