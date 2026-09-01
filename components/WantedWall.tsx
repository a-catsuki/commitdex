"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { GitHubProfileLink } from "@/components/GitHubProfileLink";
import { LeagueBadge } from "@/components/LeagueBadge";
import { TypeChip } from "@/components/TypeChip";
import { LEAGUE_LABEL, type League } from "@/lib/league";
import { TYPE_META } from "@/lib/type-meta";
import { isCreatureType, type CreatureType } from "@/lib/types";

export type WantedPoster = {
  github_username: string;
  avatar_url: string | null;
  /** Photobooth mugshot when present; falls back to avatar. */
  photo_url?: string | null;
  persona_title: string;
  dominant_type: string;
  league: League;
  chaos: number;
  featured_name: string | null;
};

type Props = {
  trainers: WantedPoster[];
};

/** Visual wall columns: #2 · #1 · #3 (CSS order finishes the layout). */
const BULLETIN_ORDER = [1, 0, 2] as const;

function resolveType(raw: string): CreatureType {
  return isCreatureType(raw) ? raw : "chaotic";
}

function matchesQuery(trainer: WantedPoster, query: string): boolean {
  if (!query) return true;
  const hay = `${trainer.github_username} ${trainer.persona_title}`.toLowerCase();
  return hay.includes(query);
}

/** Commitdex bounty copy from real trainer fields (no money). */
function bountyCopy(trainer: WantedPoster): {
  chaosLine: string;
  leagueLine: string;
  crimeLine: string;
} {
  const type = resolveType(trainer.dominant_type);
  const typeLabel = TYPE_META[type].label.toUpperCase();
  const leagueLabel = LEAGUE_LABEL[trainer.league].toUpperCase();
  const crime = trainer.featured_name
    ? `FOR "${trainer.featured_name}"`
    : `FOR ${typeLabel} COMMITS`;

  return {
    chaosLine: `BOUNTY: ${trainer.chaos} CHAOS`,
    leagueLine: `BOUNTY: ${leagueLabel} LEAGUE`,
    crimeLine: `DEAD OR ALIVE · ${crime}`,
  };
}

function PosterMug({
  avatarUrl,
  photoUrl,
  size,
  className = "poster__mug",
}: {
  avatarUrl: string | null;
  photoUrl?: string | null;
  size: number;
  className?: string;
}) {
  const src = photoUrl || avatarUrl;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={className}
        src={src}
        alt=""
        width={size}
        height={size}
      />
    );
  }
  return <span className={`${className} poster__mug--empty`} aria-hidden="true" />;
}

function PosterLink({
  trainer,
  rank,
}: {
  trainer: WantedPoster;
  rank: number;
}) {
  const type = resolveType(trainer.dominant_type);
  const rankLabel = String(rank).padStart(2, "0");

  return (
    <div className="poster-shell">
      <Link
        className="poster"
        href={`/t/${trainer.github_username}`}
        prefetch={rank <= 3}
        data-type={type}
        data-rank={rank <= 3 ? String(rank) : undefined}
      >
        <span className="poster__rank" aria-label={`Rank ${rank}`}>
          {rankLabel}
        </span>
        <PosterMug
          avatarUrl={trainer.avatar_url}
          photoUrl={trainer.photo_url}
          size={56}
        />
        <span className="poster__body">
          <span className="poster__name">@{trainer.github_username}</span>
          <span className="poster__title">{trainer.persona_title}</span>
          <span className="poster__meta">
            <TypeChip type={type} />
            <LeagueBadge league={trainer.league} />
            <span className="chaos-pip">chaos {trainer.chaos}</span>
            {trainer.featured_name ? (
              <span className="poster__foil">{trainer.featured_name}</span>
            ) : (
              <span className="poster__foil poster__foil--empty">no foil</span>
            )}
          </span>
        </span>
      </Link>
      <div className="github-ext-footer">
        <GitHubProfileLink username={trainer.github_username} variant="poster" />
      </div>
    </div>
  );
}

function BulletinPoster({
  trainer,
  place,
}: {
  trainer: WantedPoster;
  place: 1 | 2 | 3;
}) {
  const type = resolveType(trainer.dominant_type);
  const bounty = bountyCopy(trainer);
  const mugSize = place === 1 ? 140 : 112;
  const caseId = String(place).padStart(2, "0");

  return (
    <div className="bulletin-poster-shell">
      <Link
        className="bulletin-poster"
        href={`/t/${trainer.github_username}`}
        data-type={type}
        data-place={place}
      >
      <span className="bulletin-poster__scan" aria-hidden="true" />
      {place === 1 ? (
        <span className="bulletin-poster__foil" aria-hidden="true" />
      ) : null}

      <span className="bulletin-poster__chrome">
        <span className="bulletin-poster__led" aria-hidden="true" />
        <span className="bulletin-poster__stamp">CASE #{caseId}</span>
      </span>

      <span className="bulletin-poster__wanted" data-text="WANTED">
        WANTED
      </span>

      <span className="bulletin-poster__mugframe">
        <span className="bulletin-poster__mugbezel" aria-hidden="true">
          <span>DEX-CAM</span>
          <span className="bulletin-poster__rec">REC</span>
        </span>
        <span className="bulletin-poster__viewport">
          <PosterMug
            avatarUrl={trainer.avatar_url}
            photoUrl={trainer.photo_url}
            size={mugSize}
            className="bulletin-poster__mug"
          />
          <span className="bulletin-poster__mugscan" aria-hidden="true" />
          <span className="bulletin-poster__corners" aria-hidden="true" />
        </span>
      </span>

      <span className="bulletin-poster__identity">
        <span className="bulletin-poster__name">@{trainer.github_username}</span>
        <span className="bulletin-poster__alias">{trainer.persona_title}</span>
      </span>

      <span className="bulletin-poster__bounties">
        <span className="bulletin-poster__bounty">{bounty.chaosLine}</span>
        <span className="bulletin-poster__league">{bounty.leagueLine}</span>
        <span className="bulletin-poster__crime">{bounty.crimeLine}</span>
      </span>

      <span className="bulletin-poster__meta">
        <TypeChip type={type} />
        <LeagueBadge league={trainer.league} />
      </span>
      </Link>
      <div className="github-ext-footer">
        <GitHubProfileLink username={trainer.github_username} variant="poster" />
      </div>
    </div>
  );
}

export function WantedWall({ trainers }: Props) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const rankByUser = useMemo(() => {
    const map = new Map<string, number>();
    trainers.forEach((trainer, index) => {
      map.set(trainer.github_username, index + 1);
    });
    return map;
  }, [trainers]);

  const filtered = useMemo(
    () => trainers.filter((trainer) => matchesQuery(trainer, deferredQuery)),
    [trainers, deferredQuery],
  );

  const searching = deferredQuery.length > 0;
  const topThree = !searching ? trainers.slice(0, 3) : [];
  const listItems = searching
    ? filtered.map((trainer) => ({
        trainer,
        rank: rankByUser.get(trainer.github_username) ?? 0,
      }))
    : filtered.slice(3).map((trainer, index) => ({
        trainer,
        rank: index + 4,
      }));

  return (
    <div className="wanted__wall">
      <div className="wanted__toolbar">
        <label className="wanted__search" htmlFor={searchId}>
          <span className="wanted__search-prefix" aria-hidden="true">
            <span className="prompt__dollar">$</span>grep
          </span>
          <input
            id={searchId}
            className="wanted__search-input"
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="username or persona title"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <p className="wanted__count" aria-live="polite" data-searching={searching}>
          <span className="wanted__count-led" aria-hidden="true" />
          {filtered.length}/{trainers.length} posters
        </p>
      </div>

      {!searching && topThree.length > 0 ? (
        <section className="bulletin" aria-label="Top three most wanted">
          <p className="bulletin__kicker">crt feed · top three</p>
          <ol className="bulletin__row" data-count={String(topThree.length)}>
            {BULLETIN_ORDER.map((index) => {
              const trainer = topThree[index];
              if (!trainer) return null;
              const place = (index + 1) as 1 | 2 | 3;
              return (
                <li
                  key={trainer.github_username}
                  className="bulletin__slot"
                  data-place={place}
                >
                  <BulletinPoster trainer={trainer} place={place} />
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {filtered.length === 0 ? (
        <p className="wanted__empty" role="status">
          No posters match that query. Clear the grep and try again.
        </p>
      ) : listItems.length > 0 ? (
        <ol
          className="wanted__list"
          aria-label={searching ? "Search results" : "Ranks 4 and below"}
        >
          {listItems.map(({ trainer, rank }) => (
            <li key={trainer.github_username}>
              <PosterLink trainer={trainer} rank={rank} />
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
