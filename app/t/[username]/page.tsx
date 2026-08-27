import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeagueBadge } from "@/components/LeagueBadge";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { TrainerScan } from "@/components/TrainerScan";
import { TypeChip } from "@/components/TypeChip";
import { getTrainer } from "@/lib/db";
import { modelLabel, OPENROUTER_MODEL } from "@/lib/model";
import { TYPE_META } from "@/lib/type-meta";
import { isCreatureType } from "@/lib/types";

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
