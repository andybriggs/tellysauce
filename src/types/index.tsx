export type AutoCompleteResult = {
  id: number;
  name: string;
  type: "movie" | "tv";
  year?: number;
  poster?: string | null;
  backdrop?: string | null;
};

export type Title = {
  id: number;
  name: string;
  poster: string | null;
  type: string | undefined;
  rating: number;
  description: string | null;
  year?: number;
};

export type TitleMeta = Omit<Title, "rating">;

export type StreamingSource = {
  name: string;
  region: string;
  type: string;
  icon: string;
};

export type Recommendation = {
  title: string;
  tags?: string[];
  description?: string;
  reason?: string;
};
