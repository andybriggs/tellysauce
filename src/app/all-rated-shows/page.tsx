import RatedShows from "../components/RatedShows";
import Container from "../components/Container";
import BackLink from "../components/BackLink";

export default function AllRatedShowsPage() {
  return (
    <div className="mb-6">
      <Container>
        <div className="col-span-full mb-4">
          <BackLink href="/" label="Back" />
        </div>
        <RatedShows layout="grid" />
      </Container>
    </div>
  );
}
