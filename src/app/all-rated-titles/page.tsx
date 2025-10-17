import RatedTitles from "@/components/RatedTitles";
import Container from "@/components/Container";
import BackLink from "@/components/BackLink";

export default function AllRatedTitlesPage() {
  return (
    <div className="pt-6">
      <Container>
        <div className="col-span-full mb-4">
          <BackLink href="/" label="Back" />
        </div>
        <RatedTitles layout="grid" />
      </Container>
    </div>
  );
}
