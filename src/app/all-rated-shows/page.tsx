// app/all-rated-shows/page.tsx
import MyRatedShows from "@/app/components/MyRatedShows";
import Container from "../components/Container";
import BackLink from "../components/BackLink";

export default function AllRatedShowsPage() {
  return (
    <div className="mb-6">
      <Container>
        <div className="col-span-full mb-4">
          <BackLink href="/" label="Back" />
        </div>
        <MyRatedShows layout="grid" />
      </Container>
    </div>
  );
}
