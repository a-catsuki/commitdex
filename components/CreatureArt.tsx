import type { CreatureType } from "@/lib/types";

type ArtProps = {
  type: CreatureType;
};

export function CreatureArt({ type }: ArtProps) {
  return (
    <svg
      className="creature-art"
      viewBox="0 0 200 140"
      role="img"
      aria-hidden="true"
    >
      {type === "lazy" ? <LazyArt /> : null}
      {type === "vague" ? <VagueArt /> : null}
      {type === "panic" ? <PanicArt /> : null}
      {type === "overconfident" ? <OverconfidentArt /> : null}
      {type === "passive-aggressive" ? <PassiveArt /> : null}
      {type === "corporate" ? <CorporateArt /> : null}
      {type === "chaotic" ? <ChaoticArt /> : null}
      {type === "emoji" ? <EmojiArt /> : null}
    </svg>
  );
}

function LazyArt() {
  return (
    <g fill="currentColor">
      <ellipse cx="100" cy="92" rx="62" ry="28" opacity="0.95" />
      <ellipse cx="78" cy="70" rx="28" ry="22" />
      <ellipse cx="118" cy="68" rx="18" ry="14" opacity="0.85" />
      <rect x="48" y="96" width="18" height="8" rx="3" opacity="0.7" />
      <rect x="134" y="96" width="22" height="8" rx="3" opacity="0.7" />
      <circle cx="70" cy="66" r="4" fill="var(--card-paper)" />
      <circle cx="71" cy="67" r="1.5" />
      <path d="M88 78c8 4 16 4 24 0" fill="none" stroke="var(--card-paper)" strokeWidth="2" />
    </g>
  );
}

function VagueArt() {
  return (
    <g fill="currentColor">
      <ellipse cx="100" cy="78" rx="54" ry="38" opacity="0.35" />
      <ellipse cx="86" cy="72" rx="36" ry="28" opacity="0.45" />
      <ellipse cx="118" cy="80" rx="32" ry="24" opacity="0.4" />
      <text
        x="100"
        y="86"
        textAnchor="middle"
        fontSize="42"
        fontFamily="ui-monospace, monospace"
        opacity="0.85"
      >
        ?
      </text>
    </g>
  );
}

function PanicArt() {
  return (
    <g fill="currentColor">
      <polygon points="100,18 118,48 148,38 138,68 178,82 140,96 150,128 100,110 50,128 60,96 22,82 62,68 52,38 82,48" />
      <circle cx="84" cy="78" r="12" fill="var(--card-paper)" />
      <circle cx="116" cy="78" r="12" fill="var(--card-paper)" />
      <circle cx="86" cy="80" r="5" />
      <circle cx="118" cy="80" r="5" />
      <path d="M88 102c8 10 16 10 24 0" fill="none" stroke="var(--card-paper)" strokeWidth="3" />
    </g>
  );
}

function OverconfidentArt() {
  return (
    <g fill="currentColor">
      <polygon points="100,16 108,36 128,36 112,48 118,66 100,54 82,66 88,48 72,36 92,36" />
      <ellipse cx="100" cy="88" rx="36" ry="40" />
      <rect x="88" y="118" width="8" height="16" />
      <rect x="104" y="118" width="8" height="16" />
      <circle cx="90" cy="82" r="5" fill="var(--card-paper)" />
      <circle cx="110" cy="82" r="5" fill="var(--card-paper)" />
      <path d="M88 98c8-6 16-6 24 0" fill="none" stroke="var(--card-paper)" strokeWidth="3" />
    </g>
  );
}

function PassiveArt() {
  return (
    <g fill="currentColor">
      <path d="M36 88c0-28 28-52 64-52s64 24 64 52c0 8-6 14-18 18-20 8-52 8-72 0-12-4-18-10-18-18z" />
      <path d="M168 86c18 4 28 16 22 28-8 4-22 0-32-10" opacity="0.85" />
      <ellipse cx="82" cy="78" rx="10" ry="8" fill="var(--card-paper)" />
      <ellipse cx="118" cy="80" rx="7" ry="6" fill="var(--card-paper)" />
      <circle cx="86" cy="78" r="3" />
      <circle cx="120" cy="80" r="2.5" />
      <path d="M78 98c18 10 40 10 52-2" fill="none" stroke="var(--card-paper)" strokeWidth="3" />
    </g>
  );
}

function CorporateArt() {
  return (
    <g fill="currentColor">
      <rect x="70" y="28" width="60" height="44" rx="2" />
      <rect x="88" y="40" width="24" height="16" fill="var(--card-paper)" />
      <rect x="62" y="72" width="76" height="52" rx="2" />
      <polygon points="100,78 108,108 92,108" fill="var(--card-paper)" />
      <rect x="78" y="40" width="14" height="8" fill="var(--card-paper)" opacity="0.7" />
      <rect x="108" y="40" width="14" height="8" fill="var(--card-paper)" opacity="0.7" />
    </g>
  );
}

function ChaoticArt() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
      <path d="M40 90c20-40 40 30 70-20 20-30 50 10 50 30" />
      <path d="M52 50c30 40 40-20 80 10 18 14 28 40 8 54" />
      <path d="M36 70c-8 20 10 40 30 24" />
      <path d="M160 64c18 8 22 28 6 38" />
      <circle cx="84" cy="72" r="6" fill="currentColor" stroke="none" />
      <circle cx="128" cy="80" r="6" fill="currentColor" stroke="none" />
      <circle cx="108" cy="58" r="5" fill="currentColor" stroke="none" />
    </g>
  );
}

function EmojiArt() {
  return (
    <g fill="currentColor">
      <circle cx="100" cy="72" r="44" />
      <circle cx="84" cy="64" r="6" fill="var(--card-paper)" />
      <circle cx="116" cy="64" r="6" fill="var(--card-paper)" />
      <path
        d="M78 86c8 16 36 16 44 0"
        fill="none"
        stroke="var(--card-paper)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="156" cy="40" r="8" opacity="0.7" />
      <circle cx="44" cy="38" r="5" opacity="0.5" />
    </g>
  );
}
