import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DexReel } from "@/components/DexReel";
import { DossierDailyPick } from "@/components/DossierDailyPick";
import { DossierPhotobooth } from "@/components/DossierPhotobooth";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { TrainerRadar } from "@/components/TrainerRadar";
import { TrainerScan } from "@/components/TrainerScan";
import { TypeChip } from "@/components/TypeChip";
import { curateCommitsForSpin } from "@/lib/curate";
import { getTrainer, trainerPhotoSrc } from "@/lib/db";
import { fetchPublicCommits } from "@/lib/github";
import { LEAGUE_LABEL } from "@/lib/league";
import { modelLabel, OPENROUTER_MODEL } from "@/lib/model";
import { predictionCategoryLabel, predictionCategorySymbol } from "@/lib/prediction-icons";
import { COPY } from "@/lib/public-error";
import { evaluateSpinEligibility, isNewUtcDaySince } from "@/lib/spin-eligibility";
import { TYPE_META } from "@/lib/type-meta";
import { isCreatureType } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ username: string }>;
};

const HUD_STATS = [
  ["clarity", "CLR"],
  ["effort", "EFF"],
  ["honesty", "HON"],
  ["chaos", "CHA"],
] as const;

/** Short STATUS pill from spin eligibility — never opaque "FOIL LOCKED". */
function spinStatusLabel(
  hasFeatured: boolean,
  canSpin: boolean,
  spinLockedReason: string | null,
): string {
  if (!hasFeatured) return "SPIN READY";
  if (canSpin) return "RESPIN OPEN";
  if (spinLockedReason === COPY.alreadyPulledToday) return "ALREADY PULLED TODAY";
  if (spinLockedReason === COPY.noNewSpecimens) return "WAITING ON NEW COMMITS";
  return "PICK LOCKED UNTIL TOMORROW";
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const trainer = await getTrainer(username).catch(() => null);
  if (!trainer) {
    return { title: `@${username} — Commitdex` };
  }
  return {
    title: `${trainer.persona_title} (@${trainer.github_username}) — Commitdex`,
    description: `A ${TYPE_META[trainer.dominant_type].label} type trainer. Chaos ${trainer.chaos}. Ranked on Most Wanted.`,
    openGraph: {
      title: `@${trainer.github_username} is ${trainer.persona_title}`,
      description: `${TYPE_META[trainer.dominant_type].label} · chaos ${trainer.chaos}`,
    },
  };
}

export default async function TrainerPage({ params }: PageProps) {
  const { username } = await params;
  let trainer;
  try {
    trainer = await getTrainer(username);
  } catch {
    trainer = null;
  }
  if (!trainer) notFound();

  const type = isCreatureType(trainer.dominant_type) ? trainer.dominant_type : "chaotic";
  let reel =
    trainer.reel_commits.length > 0 ? trainer.reel_commits : trainer.sample_messages;
  let canSpin = !trainer.featured_card;
  let spinLockedReason: string | null = null;

  if (trainer.featured_card) {
    if (!trainer.featured_at || !isNewUtcDaySince(trainer.featured_at)) {
      canSpin = false;
      spinLockedReason = COPY.alreadyPulledToday;
    } else {
      try {
        const commits = await fetchPublicCommits(trainer.github_username, 100);
        const eligibility = evaluateSpinEligibility(trainer.featured_at, true, commits);
        canSpin = eligibility.canSpin;
        spinLockedReason = eligibility.spinLockedReason;
        const curated = curateCommitsForSpin(commits, trainer.featured_at);
        if (curated.length > 0) reel = curated;
      } catch {
        canSpin = false;
        spinLockedReason = COPY.noNewSpecimens;
      }
    }
  }

  const stats = {
    clarity: trainer.clarity,
    effort: trainer.effort,
    honesty: trainer.honesty,
    chaos: trainer.chaos,
  };

  const mugshot = trainerPhotoSrc(trainer);
  const headShot = mugshot ?? trainer.avatar_url;
  const foilLocked = Boolean(trainer.featured_card && !canSpin);
  const statusLabel = spinStatusLabel(
    Boolean(trainer.featured_card),
    canSpin,
    spinLockedReason,
  );

  const showBooth = Boolean(trainer.featured_card);
  const hasSpecimen =
    Boolean(trainer.featured_card) || reel.length > 0;

  return (
    <>
      <SiteNav />
      <main className="dossier">
        <p className="dossier__crumb">
          <Link href="/wanted">Most Wanted</Link>
          <span aria-hidden="true"> / </span>
          <span>@{trainer.github_username}</span>
        </p>

        <div className="dossier__bento" data-type={type}>
          <section className="dossier-tile dossier-tile--id" aria-label="Trainer identity">
            <header className="dossier__head">
              {headShot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={
                    mugshot ? "dossier__avatar dossier__avatar--mug" : "dossier__avatar"
                  }
                  src={headShot}
                  alt=""
                  width={48}
                  height={48}
                />
              ) : null}
              <div className="dossier__id">
                <p className="dossier__handle">@{trainer.github_username}</p>
                <h1 className="dossier__title">{trainer.persona_title}</h1>
                <p className="dossier__badges">
                  <TypeChip type={type} />
                  <span className="dossier__count">
                    {trainer.total_commits_analyzed} msg
                  </span>
                </p>
              </div>
            </header>
          </section>

          <section className="dossier-tile dossier-tile--chaos" aria-label="Chaos score">
            <p className="dossier-hud__label">CHAOS</p>
            <p className="dossier-hud__num">{trainer.chaos}</p>
          </section>

          <section className="dossier-tile dossier-tile--league" aria-label="League">
            <p className="dossier-hud__label">LEAGUE</p>
            <p className="dossier-hud__league" data-league={trainer.league}>
              {LEAGUE_LABEL[trainer.league]}
            </p>
          </section>

          <section
            className="dossier-tile dossier-tile--status"
            aria-label={showBooth ? "Mugshot booth" : "Spin status"}
          >
            {/* Lock copy lives once on the specimen bar when a foil exists. */}
            <p className="dossier-hud__label">{showBooth ? "MUGSHOT" : "STATUS"}</p>
            {!showBooth ? (
              <p
                className={
                  foilLocked
                    ? "dossier-status-pill dossier-status-pill--locked"
                    : "dossier-status-pill dossier-status-pill--open"
                }
              >
                {statusLabel}
              </p>
            ) : (
              <DossierPhotobooth
                username={trainer.github_username}
                existingPhotoUrl={mugshot}
              />
            )}
          </section>

          <section
            className="dossier-tile dossier-tile--analytics"
            aria-label="Trainer analytics"
          >
            <p className="dossier-hud__label">ANALYTICS</p>
            <div className="dossier-analytics">
              <TrainerRadar {...stats} />
              <dl className="dossier__stats">
                {HUD_STATS.map(([key, short]) => (
                  <div key={key} className="dex-stat dossier-hud-stat">
                    <dt>
                      <span className="dossier-hud-stat__atk">{short}</span>
                      <span className="dossier-hud-stat__name">{key}</span>
                    </dt>
                    <dd>
                      <span className="dex-stat__track" aria-hidden="true">
                        <span
                          className="dex-stat__fill"
                          style={{ ["--v" as string]: stats[key] }}
                        />
                      </span>
                      <span className="dex-stat__n">{stats[key]}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {hasSpecimen ? (
            <div className="dossier-tile dossier-tile--specimen">
              {trainer.featured_card ? (
                <DossierDailyPick
                  username={trainer.github_username}
                  card={trainer.featured_card}
                  canSpin={canSpin}
                  spinLockedReason={spinLockedReason}
                  reel={reel}
                  photoUrl={mugshot}
                />
              ) : reel.length > 0 ? (
                <DexReel
                  username={trainer.github_username}
                  reel={reel}
                  mode="first"
                  photoUrl={mugshot}
                />
              ) : null}
            </div>
          ) : null}

          <section className="dossier-tile dossier-tile--preds" aria-label="Predictions">
            <div className="dossier-tile__head">
              <h2>Predictions</h2>
              <p className="dossier__note dossier__note--tight">
                Locked on first scan · {modelLabel(OPENROUTER_MODEL)} · jokes, not surveillance
              </p>
            </div>
            <ul className="dossier-preds">
              {trainer.predictions.map((prediction, i) => (
                <li key={`${prediction.category}-${i}`} className="dossier-pred">
                  <div className="dossier-pred__topline">
                    <span className="dossier-pred__icon" aria-hidden="true">
                      {predictionCategorySymbol(prediction.category)}
                    </span>
                    <span className="dossier-pred__tag">
                      {predictionCategoryLabel(prediction.category)}
                    </span>
                  </div>
                  <h3 className="dossier-pred__title">{prediction.title}</h3>
                  <p className="dossier-pred__text" title={prediction.text}>
                    {prediction.text}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {trainer.sample_messages.length > 0 ? (
            <section className="dossier-tile dossier-tile--evidence" aria-label="Evidence">
              <div className="dossier-tile__head">
                <h2>Evidence</h2>
                <p className="dossier__note dossier__note--tight">
                  {trainer.sample_messages.length} sample messages
                </p>
              </div>
              <ol className="dossier-evidence">
                {trainer.sample_messages.map((message, i) => (
                  <li key={`${i}-${message.slice(0, 32)}`}>
                    <span className="dossier-evidence__n" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <code>{message}</code>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <TrainerScan />
      </main>
      <SiteFooter />
    </>
  );
}
