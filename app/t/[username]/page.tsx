import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DexReel } from "@/components/DexReel";
import { CreatureCard } from "@/components/CreatureCard";
import { LeagueBadge } from "@/components/LeagueBadge";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { TrainerScan } from "@/components/TrainerScan";
import { TypeChip } from "@/components/TypeChip";
import { curateCommitsForSpin } from "@/lib/curate";
import { getTrainer } from "@/lib/db";
import { fetchPublicCommits } from "@/lib/github";
import { modelLabel, OPENROUTER_MODEL } from "@/lib/model";
import { COPY } from "@/lib/public-error";
import { evaluateSpinEligibility, isNewUtcDaySince } from "@/lib/spin-eligibility";
import { TYPE_META } from "@/lib/type-meta";
import { isCreatureType } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ username: string }>;
};

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

  const stats = [
    ["clarity", trainer.clarity],
    ["effort", trainer.effort],
    ["honesty", trainer.honesty],
    ["chaos", trainer.chaos],
  ] as const;

  return (
    <>
      <SiteNav />
      <main className="dossier">
        <p className="dossier__crumb">
          <Link href="/wanted">Most Wanted</Link>
          <span aria-hidden="true"> / </span>
          <span>@{trainer.github_username}</span>
        </p>

        <header className="dossier__head" data-type={type}>
          {trainer.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="dossier__avatar"
              src={trainer.avatar_url}
              alt=""
              width={72}
              height={72}
            />
          ) : null}
          <div className="dossier__id">
            <p className="dossier__handle">@{trainer.github_username}</p>
            <h1 className="dossier__title">{trainer.persona_title}</h1>
            <p className="dossier__badges">
              <TypeChip type={type} />
              <LeagueBadge league={trainer.league} />
              <span className="dossier__count">
                {trainer.total_commits_analyzed} messages
              </span>
            </p>
          </div>
        </header>

        {trainer.featured_card && canSpin && reel.length > 0 ? (
          <DexReel username={trainer.github_username} reel={reel} mode="respin" />
        ) : trainer.featured_card ? (
          <section className="dossier__foil">
            <h2>Allotted specimen</h2>
            <p className="dossier__note">
              {spinLockedReason ??
                "One foil per UTC day. Fresh public commits unlock tomorrow's crank."}
            </p>
            <CreatureCard card={trainer.featured_card} />
          </section>
        ) : reel.length > 0 ? (
          <DexReel username={trainer.github_username} reel={reel} mode="first" />
        ) : null}

        <dl className="dossier__stats" data-type={type}>
          {stats.map(([label, value]) => (
            <div key={label} className="dex-stat">
              <dt>{label}</dt>
              <dd>
                <span className="dex-stat__track" aria-hidden="true">
                  <span className="dex-stat__fill" style={{ ["--v" as string]: value }} />
                </span>
                <span className="dex-stat__n">{value}</span>
              </dd>
            </div>
          ))}
        </dl>

        <section className="dossier__preds">
          <h2>Predictions</h2>
          <p className="dossier__note">
            Locked on first scan. Written by {modelLabel(OPENROUTER_MODEL)}. Jokes, not surveillance.
          </p>
          <ol>
            {trainer.predictions.map((prediction) => (
              <li key={prediction.text}>{prediction.text}</li>
            ))}
          </ol>
        </section>

        {trainer.sample_messages.length > 0 ? (
          <section className="dossier__samples">
            <h2>Evidence</h2>
            <ul>
              {trainer.sample_messages.map((message) => (
                <li key={message}>
                  <code>{message}</code>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <TrainerScan />
      </main>
      <SiteFooter />
    </>
  );
}
