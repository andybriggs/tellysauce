import Container from "../components/Container";
import BackLink from "../components/BackLink";
import Watchlist from "../components/Watchlist";

export default function WatchlistPage() {
  return (
    <div className="pt-6">
      <Container>
        <div className="col-span-full mb-4">
          <BackLink href="/" label="Back" />
        </div>
        <Watchlist layout="grid" />
      </Container>
    </div>
  );
}
