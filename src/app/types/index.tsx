export type AutoCompleteResult = {
  id: number;
  name: string;
  image_url: string;
  type: string;
};

export type Show = {
  id: number;
  name: string;
  image: string | null;
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
