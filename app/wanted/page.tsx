import Link from "next/link";
import { LeagueBadge } from "@/components/LeagueBadge";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { TrainerScan } from "@/components/TrainerScan";
import { TypeChip } from "@/components/TypeChip";
import { COPY } from "@/lib/public-error";
import { listWanted } from "@/lib/db";
import { isCreatureType } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Most Wanted — Commitdex",
  description: "Public ranking of trainers by chaos score. Nobody asked to be here.",
};

export default async function WantedPage() {
  let trainers: Awaited<ReturnType<typeof listWanted>> = [];
  let loadError: string | null = null;
  try {
    trainers = await listWanted(50);
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
        ) : trainers.length === 0 ? (
          <p className="wanted__empty">No posters yet. Scan a username below and start the wall.</p>
        ) : (
          <ol className="wanted__list">
            {trainers.map((trainer, index) => {
              const type = isCreatureType(trainer.dominant_type)
                ? trainer.dominant_type
                : "chaotic";
              const rank = String(index + 1).padStart(2, "0");
              return (
                <li key={trainer.github_username}>
                  <Link
                    className="poster"
                    href={`/t/${trainer.github_username}`}
                    data-type={type}
                    data-rank={index < 3 ? String(index + 1) : undefined}
                  >
                    <span className="poster__rank" aria-label={`Rank ${index + 1}`}>
                      {rank}
                    </span>
                    {trainer.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="poster__mug"
                        src={trainer.avatar_url}
                        alt=""
                        width={56}
                        height={56}
                      />
                    ) : (
                      <span className="poster__mug poster__mug--empty" aria-hidden="true" />
                    )}
                    <span className="poster__body">
                      <span className="poster__name">@{trainer.github_username}</span>
                      <span className="poster__title">{trainer.persona_title}</span>
                      <span className="poster__meta">
                        <TypeChip type={type} />
                        <LeagueBadge league={trainer.league} />
                        <span className="chaos-pip">chaos {trainer.chaos}</span>
                        {trainer.featured_card ? (
                          <span className="poster__foil">{trainer.featured_card.name}</span>
                        ) : (
                          <span className="poster__foil poster__foil--empty">no foil</span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        <TrainerScan />
      </main>
      <SiteFooter />
    </>
  );
}
