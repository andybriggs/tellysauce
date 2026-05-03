import { fetchAiPopularTitles } from "@/server/aiPopular";
import HomeClient from "@/components/layout/HomeClient";

export default async function Home() {
  const [aiMovies, aiTv] = await Promise.all([
    fetchAiPopularTitles("movie"),
    fetchAiPopularTitles("tv"),
  ]);

  return <HomeClient aiMovies={aiMovies} aiTv={aiTv} />;
}
