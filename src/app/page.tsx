import { fetchAiPopularTitles } from "@/server/aiPopular";
import HomeClient from "@/components/layout/HomeClient";

export const revalidate = 86400; // AI picks refresh once per day via cron

export default async function Home() {
  const [aiMovies, aiTv] = await Promise.all([
    fetchAiPopularTitles("movie"),
    fetchAiPopularTitles("tv"),
  ]);

  return <HomeClient aiMovies={aiMovies} aiTv={aiTv} />;
}
