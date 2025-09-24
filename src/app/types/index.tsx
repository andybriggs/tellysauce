export type AutoCompleteResult = {
  id: number;
  name: string;
  type: "movie" | "tv";
  year?: number;
  poster?: string | null;
  backdrop?: string | null;
};

export type Show = {
  id: number;
  name: string;
  poster: string | null;
  type: string | undefined;
  rating: number;
  description: string | null;
};

export type StreamingSource = {
  name: string;
  region: string;
  type: string;
};

export type Recommendation = {
  title: string;
  tags?: string[];
  description?: string;
  reason?: string;
};
