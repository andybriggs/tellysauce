import RatedTitles from "@/components/watchlist/RatedTitles";
import Container from "@/components/common/Container";
import BackLink from "@/components/layout/BackLink";

export default function AllRatedTitlesPage() {
  return (
    <div className="pt-6">
      <Container>
        <div className="col-span-full mb-4">
          <BackLink fallbackHref="/" label="Back" />
        </div>
        <RatedTitles layout="grid" />
      </Container>
    </div>
  );
}
