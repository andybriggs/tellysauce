export type AutoCompleteResult = {
  id: number;
  name: string;
  image_url: string;
  type: string;
};

export type Show = {
  id: number;
  name: string;
  image: string;
  type: string;
};

export type StreamingSource = {
  name: string;
  region: string;
  type: string;
};

export type Recommendation = {
  title: string;
  description: string;
  tags: string[];
};
