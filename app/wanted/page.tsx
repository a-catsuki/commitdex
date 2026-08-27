import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { TrainerScan } from "@/components/TrainerScan";
import { WantedWall, type WantedPoster } from "@/components/WantedWall";
import { COPY } from "@/lib/public-error";
import { listWanted, trainerPhotoSrc } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Most Wanted — Commitdex",
  description: "Public ranking of trainers by chaos score. Nobody asked to be here.",
};

export default async function WantedPage() {
  let posters: WantedPoster[] = [];
  let loadError: string | null = null;
  try {
    const trainers = await listWanted(50);
    posters = trainers.map((trainer) => ({
      github_username: trainer.github_username,
      avatar_url: trainer.avatar_url,
      photo_url: trainerPhotoSrc(trainer),
      persona_title: trainer.persona_title,
      dominant_type: trainer.dominant_type,
      league: trainer.league,
      chaos: trainer.chaos,
      featured_name: trainer.featured_card?.name ?? null,
    }));
  } catch (error) {
    console.error("[commitdex:wanted]", error);
    loadError = COPY.wantedOffline;
  }

  return (
    <>
      <SiteNav />
      <main className="wanted">
        <header className="wanted__hero">
          <p className="wanted__kicker">the holding cell</p>
          <h1 className="wanted__title">Most Wanted</h1>
          <p className="wanted__lede">
            Ranked by chaos. Posted here the moment someone scans a public GitHub history.
          </p>
        </header>

        {loadError ? (
          <p className="prompt__error" role="alert">
            {loadError}
          </p>
        ) : posters.length === 0 ? (
          <p className="wanted__empty">No posters yet. Scan a username below and start the wall.</p>
        ) : (
          <WantedWall trainers={posters} />
        )}

        <TrainerScan />
      </main>
      <SiteFooter />
    </>
  );
}
