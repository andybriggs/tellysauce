import Container from "@/components/common/Container";
import BackLink from "@/components/layout/BackLink";
import BackToTopButton from "@/components/common/BackToTopButton";
import Watchlist from "@/components/watchlist/Watchlist";

export default function WatchlistPage() {
  return (
    <div className="pt-6">
      <Container>
        <div className="col-span-full mb-4">
          <BackLink fallbackHref="/" label="Back" />
        </div>
        <Watchlist layout="grid" />
      </Container>
      <BackToTopButton />
    </div>
  );
}
