import type { ReactNode } from "react";
import {
  type AccessoryKit,
  type CreatureGenome,
  type EyeKit,
  type MouthKit,
  type PatternKit,
  genomeFromCard,
  mulberry32,
  range,
} from "@/lib/creature-draw";
import type { CreatureType, Rarity } from "@/lib/types";

type ArtProps = {
  type: CreatureType;
  name?: string;
  rarity?: Rarity;
  originalMessage?: string;
};

const PAPER = "var(--card-paper)";
const INK = "currentColor";
/** Light cutouts for faces — brighter than card paper so eyes read on dark wells. */
const FACE = "color-mix(in oklch, var(--card-paper) 35%, oklch(92% 0.02 145))";
const BODY_STROKE = {
  fill: INK,
  stroke: "color-mix(in oklch, var(--card-paper) 55%, transparent)",
  strokeWidth: 1.25,
  strokeLinejoin: "round" as const,
};

export function CreatureArt({
  type,
  name = "specimen",
  rarity = "common",
  originalMessage = "",
}: ArtProps) {
  const genome = genomeFromCard({
    name,
    type,
    rarity,
    original_message: originalMessage,
  });
  const clipId = `creature-art-clip-${genome.seed}`;

  return (
    <svg
      className="creature-art"
      viewBox="0 0 200 140"
      preserveAspectRatio="xMidYMid meet"
      overflow="hidden"
      role="img"
      aria-hidden="true"
      data-seed={genome.seed}
      data-body={genome.body}
      data-type={genome.type}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="200" height="140" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <AuraBackdrop genome={genome} />

        <g
          className="creature-art__bob"
          transform={`translate(100 72) rotate(${genome.tilt}) translate(${genome.lean} 0) scale(${1.08 * genome.bodyW} ${1.08 * genome.bodyH}) translate(-100 -72)`}
        >
          <TypeSprite genome={genome} />
        </g>

        {genome.foil ? <FoilShimmer genome={genome} /> : null}
      </g>
    </svg>
  );
}

/* ─── Atmosphere ─────────────────────────────────────────── */

function AuraBackdrop({ genome }: { genome: CreatureGenome }) {
  const o = genome.glow;
  if (genome.aura === "none") {
    return (
      <ellipse
        cx="100"
        cy="78"
        rx="54"
        ry="38"
        fill={INK}
        opacity={0.08 + o * 0.06}
      />
    );
  }

  if (genome.aura === "soft") {
    return (
      <g>
        <ellipse cx="100" cy="76" rx="62" ry="44" fill={INK} opacity={0.12 + o * 0.1} />
        <ellipse cx="100" cy="76" rx="48" ry="34" fill={INK} opacity={0.08} />
      </g>
    );
  }

  if (genome.aura === "ring") {
    return (
      <g fill="none" stroke={INK}>
        <ellipse cx="100" cy="74" rx="58" ry="42" strokeWidth="1.6" opacity={0.35 + o * 0.25} />
        <ellipse cx="100" cy="74" rx="68" ry="50" strokeWidth="1" opacity={0.18 + o * 0.15} />
      </g>
    );
  }

  if (genome.aura === "pulse") {
    return (
      <g>
        <ellipse cx="100" cy="74" rx="56" ry="40" fill={INK} opacity={0.1 + o * 0.08} />
        <ellipse
          className="creature-art__pulse"
          cx="100"
          cy="74"
          rx="64"
          ry="46"
          fill="none"
          stroke={INK}
          strokeWidth="1.2"
          opacity={0.4}
        />
      </g>
    );
  }

  // static — controlled glitch bars, not noise soup
  const rng = mulberry32(genome.seed ^ 0xa11a);
  const bars = Array.from({ length: 3 }, (_, i) => ({
    key: i,
    x: range(rng, 28, 150),
    y: range(rng, 22, 110),
    w: range(rng, 10, 28),
    h: range(rng, 2, 4),
  }));
  return (
    <g>
      <ellipse cx="100" cy="74" rx="52" ry="38" fill={INK} opacity={0.1} />
      {bars.map((b) => (
        <rect
          key={b.key}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          fill={INK}
          opacity={0.2 + genome.glow * 0.15}
        />
      ))}
    </g>
  );
}

function FoilShimmer({ genome }: { genome: CreatureGenome }) {
  const rng = mulberry32(genome.seed ^ 0xf011);
  const n = genome.rarity === "shiny" ? 6 : 4;
  const shards = Array.from({ length: n }, (_, i) => ({
    key: i,
    x: range(rng, 30, 170),
    y: range(rng, 14, 42),
    w: range(rng, 5, 12),
    rot: range(rng, -40, 40),
  }));
  return (
    <g fill={PAPER} opacity={0.55 + genome.glow * 0.25}>
      {shards.map((s) => (
        <rect
          key={s.key}
          x={s.x}
          y={s.y}
          width={s.w}
          height="2"
          transform={`rotate(${s.rot} ${s.x} ${s.y})`}
        />
      ))}
    </g>
  );
}

/* ─── Router ──────────────────────────────────────────────── */

function TypeSprite({ genome }: { genome: CreatureGenome }) {
  switch (genome.type) {
    case "lazy":
      return <LazySprite genome={genome} />;
    case "vague":
      return <VagueSprite genome={genome} />;
    case "panic":
      return <PanicSprite genome={genome} />;
    case "overconfident":
      return <OverconfidentSprite genome={genome} />;
    case "passive-aggressive":
      return <PassiveSprite genome={genome} />;
    case "corporate":
      return <CorporateSprite genome={genome} />;
    case "chaotic":
      return <ChaoticSprite genome={genome} />;
    case "emoji":
      return <EmojiSprite genome={genome} />;
    default:
      return null;
  }
}

/* ─── Shared face / pattern / limbs ───────────────────────── */

function Eyes({
  kit,
  lx,
  ly,
  rx,
  ry,
  size,
  spread,
  pupil,
}: {
  kit: EyeKit;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  size: number;
  spread: number;
  pupil: number;
}) {
  const s = size;
  const leftX = 100 + (lx - 100) * spread;
  const rightX = 100 + (rx - 100) * spread;
  const po = pupil;

  if (kit === "sleepy" || kit === "doze") {
    const open = kit === "doze" ? 0.4 : 0.65;
    return (
      <g className="creature-art__blink" fill={FACE}>
        <ellipse cx={leftX} cy={ly} rx={8.5 * s} ry={6.5 * s * open} />
        <ellipse cx={rightX} cy={ry} rx={8.5 * s} ry={6.5 * s * open} />
        <ellipse cx={leftX + po * 0.3} cy={ly + 0.5} rx={2.6 * s} ry={1.6 * s * open} fill={INK} />
        <ellipse cx={rightX + po * 0.3} cy={ry + 0.5} rx={2.6 * s} ry={1.6 * s * open} fill={INK} />
      </g>
    );
  }

  if (kit === "uncertain") {
    return (
      <g fill={FACE} opacity="0.9">
        <ellipse cx={leftX} cy={ly} rx={7.5 * s} ry={8 * s} />
        <ellipse cx={rightX} cy={ry} rx={5.5 * s} ry={6 * s} opacity="0.55" />
        <circle cx={leftX + po} cy={ly + 1} r={2.6 * s} fill={INK} />
        <circle cx={rightX + po * 0.5} cy={ry} r={1.6 * s} fill={INK} opacity="0.5" />
      </g>
    );
  }

  if (kit === "wide" || kit === "bug") {
    const rxE = kit === "bug" ? 10 * s : 9 * s;
    const ryE = kit === "bug" ? 11 * s : 10.5 * s;
    return (
      <g className="creature-art__blink" fill={FACE}>
        <ellipse cx={leftX} cy={ly} rx={rxE} ry={ryE} />
        <ellipse cx={rightX} cy={ry} rx={rxE} ry={ryE} />
        <circle cx={leftX + po} cy={ly + 2} r={2.8 * s} fill={INK} />
        <circle cx={rightX + po} cy={ry + 2} r={2.8 * s} fill={INK} />
        <circle cx={leftX + po - 1.4} cy={ly - 1.5} r={1.3 * s} fill={FACE} opacity="0.85" />
        <circle cx={rightX + po - 1.4} cy={ry - 1.5} r={1.3 * s} fill={FACE} opacity="0.85" />
      </g>
    );
  }

  if (kit === "smug" || kit === "squint") {
    return (
      <g stroke={FACE} strokeWidth={2.8 * s} strokeLinecap="round" fill="none">
        <path d={`M${leftX - 7 * s} ${ly + 1} Q${leftX} ${ly - 5 * s} ${leftX + 7 * s} ${ly + 1}`} />
        <path d={`M${rightX - 7 * s} ${ry + 1} Q${rightX} ${ry - 5 * s} ${rightX + 7 * s} ${ry + 1}`} />
        {kit === "smug" ? (
          <>
            <circle cx={leftX + po * 0.4} cy={ly + 2.5} r={1.7 * s} fill={INK} stroke="none" />
            <circle cx={rightX + po * 0.4} cy={ry + 2.5} r={1.7 * s} fill={INK} stroke="none" />
          </>
        ) : null}
      </g>
    );
  }

  if (kit === "narrow" || kit === "side") {
    const look = kit === "side" ? 3.5 : 0;
    return (
      <g fill={FACE}>
        <ellipse cx={leftX + look} cy={ly} rx={7.5 * s} ry={3.6 * s} />
        <ellipse cx={rightX + look} cy={ry} rx={7.5 * s} ry={3.6 * s} />
        <ellipse cx={leftX + look + po} cy={ly} rx={2.4 * s} ry={1.8 * s} fill={INK} />
        <ellipse cx={rightX + look + po} cy={ry} rx={2.4 * s} ry={1.8 * s} fill={INK} />
      </g>
    );
  }

  if (kit === "window") {
    return (
      <g fill={FACE}>
        <rect x={leftX - 9 * s} y={ly - 6 * s} width={18 * s} height={12 * s} rx="1.5" />
        <rect x={rightX - 9 * s} y={ry - 6 * s} width={18 * s} height={12 * s} rx="1.5" />
        <line
          x1={leftX}
          y1={ly - 6 * s}
          x2={leftX}
          y2={ly + 6 * s}
          stroke={INK}
          strokeWidth="1.2"
          opacity="0.4"
        />
        <line
          x1={rightX}
          y1={ry - 6 * s}
          x2={rightX}
          y2={ry + 6 * s}
          stroke={INK}
          strokeWidth="1.2"
          opacity="0.4"
        />
      </g>
    );
  }

  if (kit === "bored") {
    return (
      <g stroke={FACE} strokeWidth={2.6 * s} strokeLinecap="round" fill="none">
        <line x1={leftX - 6 * s} y1={ly} x2={leftX + 6 * s} y2={ly} />
        <line x1={rightX - 6 * s} y1={ry} x2={rightX + 6 * s} y2={ry} />
      </g>
    );
  }

  if (kit === "mismatch" || kit === "glitch") {
    return (
      <g fill={FACE}>
        <ellipse cx={leftX} cy={ly - 2} rx={9 * s} ry={10 * s} />
        <circle cx={rightX} cy={ry + 2} r={5.5 * s} />
        <circle cx={leftX + po} cy={ly} r={3.2 * s} fill={INK} />
        <rect x={rightX - 2.5 * s} y={ry} width={5 * s} height={3.5 * s} fill={INK} />
        {kit === "glitch" ? (
          <rect x={leftX + 7} y={ly - 11} width="10" height="3" fill={INK} opacity="0.5" />
        ) : null}
      </g>
    );
  }

  if (kit === "spark") {
    return (
      <g className="creature-art__blink" fill={FACE}>
        <circle cx={leftX} cy={ly} r={7.5 * s} />
        <circle cx={rightX} cy={ry} r={7.5 * s} />
        <circle cx={leftX + po} cy={ly + 0.5} r={3 * s} fill={INK} />
        <circle cx={rightX + po} cy={ry + 0.5} r={3 * s} fill={INK} />
        <path
          d={`M${leftX} ${ly - 11 * s} l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z`}
          fill={FACE}
          opacity="0.85"
        />
      </g>
    );
  }

  const r = kit === "round" ? 7.5 * s : 5.5 * s;
  return (
    <g className="creature-art__blink" fill={FACE}>
      <circle cx={leftX} cy={ly} r={r} />
      <circle cx={rightX} cy={ry} r={r} />
      <circle cx={leftX + po * 0.5} cy={ly + 0.8} r={r * 0.4} fill={INK} />
      <circle cx={rightX + po * 0.5} cy={ry + 0.8} r={r * 0.4} fill={INK} />
    </g>
  );
}

function Mouth({
  kit,
  cx,
  cy,
  w = 22,
}: {
  kit: MouthKit;
  cx: number;
  cy: number;
  w?: number;
}) {
  const half = w / 2;

  if (kit === "yawn" || kit === "open" || kit === "gasp" || kit === "big") {
    const h = kit === "big" ? 14 : kit === "gasp" ? 11 : 9;
    const rw = kit === "big" ? half * 1.15 : half * 0.8;
    return (
      <ellipse cx={cx} cy={cy + 2} rx={rw} ry={h / 2} fill={FACE} opacity="0.95" />
    );
  }

  if (kit === "drool") {
    return (
      <g fill="none" stroke={FACE} strokeWidth="2.6" strokeLinecap="round">
        <path d={`M${cx - half} ${cy}c${half * 0.4} 6 ${half * 1.2} 6 ${w} 0`} />
        <path d={`M${cx + 4} ${cy + 4}v8`} opacity="0.75" />
      </g>
    );
  }

  if (kit === "smug" || kit === "grin" || kit === "smirk") {
    const lift = kit === "smirk" ? -3 : 0;
    return (
      <path
        d={`M${cx - half} ${cy + lift}c${half * 0.45} ${12} ${half * 1.55} ${kit === "smirk" ? 7 : 12} ${w} ${kit === "smirk" ? -4 : 0}`}
        fill="none"
        stroke={FACE}
        strokeWidth="3"
        strokeLinecap="round"
      />
    );
  }

  if (kit === "sharp") {
    return (
      <path
        d={`M${cx - half} ${cy + 2} L${cx - 4} ${cy - 2} L${cx + 4} ${cy + 4} L${cx + half} ${cy - 1}`}
        fill="none"
        stroke={FACE}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  if (kit === "wavy" || kit === "zigzag") {
    const d =
      kit === "zigzag"
        ? `M${cx - half} ${cy}l${w / 4} -4 ${w / 4} 6 ${w / 4} -5 ${w / 4} 4`
        : `M${cx - half} ${cy}q${w / 6} -5 ${w / 3} 0 t${w / 3} 0 t${w / 3} 0`;
    return (
      <path d={d} fill="none" stroke={FACE} strokeWidth="2.8" strokeLinecap="round" />
    );
  }

  if (kit === "tight") {
    return <ellipse cx={cx} cy={cy} rx={half * 0.5} ry="2.4" fill={FACE} />;
  }

  return (
    <line
      x1={cx - half}
      y1={cy}
      x2={cx + half}
      y2={cy}
      stroke={FACE}
      strokeWidth="2.8"
      strokeLinecap="round"
    />
  );
}

function PatternOverlay({
  kit,
  cx,
  cy,
  rx,
  ry,
  seed,
}: {
  kit: PatternKit;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  seed: number;
}) {
  if (kit === "none") return null;
  const rng = mulberry32(seed ^ 0xc477);

  if (kit === "dots") {
    const dots = Array.from({ length: 5 }, (_, i) => ({
      key: i,
      x: cx + range(rng, -rx * 0.55, rx * 0.55),
      y: cy + range(rng, -ry * 0.45, ry * 0.5),
      r: range(rng, 1.5, 3.2),
    }));
    return (
      <g fill={PAPER} opacity="0.28">
        {dots.map((d) => (
          <circle key={d.key} cx={d.x} cy={d.y} r={d.r} />
        ))}
      </g>
    );
  }

  if (kit === "stripes") {
    return (
      <g stroke={PAPER} strokeWidth="3" opacity="0.22" strokeLinecap="round">
        <line x1={cx - rx * 0.4} y1={cy - ry * 0.35} x2={cx - rx * 0.15} y2={cy + ry * 0.4} />
        <line x1={cx} y1={cy - ry * 0.4} x2={cx + rx * 0.2} y2={cy + ry * 0.35} />
        <line x1={cx + rx * 0.35} y1={cy - ry * 0.3} x2={cx + rx * 0.5} y2={cy + ry * 0.25} />
      </g>
    );
  }

  if (kit === "patches") {
    return (
      <g fill={PAPER} opacity="0.2">
        <ellipse cx={cx - rx * 0.35} cy={cy - ry * 0.15} rx={rx * 0.28} ry={ry * 0.22} />
        <ellipse cx={cx + rx * 0.3} cy={cy + ry * 0.2} rx={rx * 0.22} ry={ry * 0.18} />
      </g>
    );
  }

  // scan
  return (
    <g stroke={PAPER} strokeWidth="1.2" opacity="0.18">
      <line x1={cx - rx * 0.7} y1={cy - 6} x2={cx + rx * 0.7} y2={cy - 6} />
      <line x1={cx - rx * 0.7} y1={cy + 4} x2={cx + rx * 0.7} y2={cy + 4} />
      <line x1={cx - rx * 0.7} y1={cy + 14} x2={cx + rx * 0.7} y2={cy + 14} />
    </g>
  );
}

function Accessory({
  kit,
  genome,
  anchorY = 36,
}: {
  kit: AccessoryKit;
  genome: CreatureGenome;
  anchorY?: number;
}) {
  if (kit === "none") return null;

  if (kit === "zzz") {
    return (
      <g fill={FACE} opacity="0.9" fontFamily="ui-monospace, monospace" fontWeight="700">
        <text x="148" y={anchorY} fontSize="12">
          z
        </text>
        <text x="158" y={anchorY - 10} fontSize="15">
          z
        </text>
        <text x="170" y={anchorY - 24} fontSize="18">
          Z
        </text>
      </g>
    );
  }

  if (kit === "pillow") {
    return (
      <ellipse cx="48" cy="100" rx="18" ry="10" fill={INK} opacity="0.55" />
    );
  }

  if (kit === "question") {
    return (
      <text
        x="148"
        y={anchorY + 4}
        textAnchor="middle"
        fontSize={22 + genome.variant * 2}
        fontFamily="ui-monospace, monospace"
        fill={FACE}
        opacity="0.85"
      >
        ?
      </text>
    );
  }

  if (kit === "haze") {
    return (
      <g fill={INK} opacity="0.2">
        <ellipse cx="70" cy="40" rx="16" ry="8" />
        <ellipse cx="130" cy="36" rx="20" ry="10" />
      </g>
    );
  }

  if (kit === "sweat") {
    return (
      <g fill={FACE} opacity="0.9">
        <path d="M142 48c0 6-4 10-8 10s-8-4-8-10 8-14 8-14 8 8 8 14z" />
        <path d="M58 52c0 4-3 7-6 7s-6-3-6-7 6-10 6-10 6 6 6 10z" opacity="0.75" />
      </g>
    );
  }

  if (kit === "spikes") {
    const n = 3 + (genome.variant % 3);
    const span = 70;
    return (
      <g fill={INK}>
        {Array.from({ length: n }, (_, i) => {
          const t = (i + 0.5) / n;
          const x = 100 - span / 2 + t * span;
          const h = 12 + (i % 2) * 5 + genome.variant * 2;
          return (
            <polygon
              key={i}
              points={`${x},${anchorY - h} ${x - 5},${anchorY} ${x + 5},${anchorY}`}
            />
          );
        })}
      </g>
    );
  }

  if (kit === "crown") {
    return (
      <polygon
        points={`100,${anchorY - 14} 107,${anchorY + 2} 118,${anchorY + 2} 110,${anchorY + 8} 113,${anchorY + 18} 100,${anchorY + 11} 87,${anchorY + 18} 90,${anchorY + 8} 82,${anchorY + 2} 93,${anchorY + 2}`}
        fill={INK}
      />
    );
  }

  if (kit === "cape") {
    return (
      <path
        d={`M78 70 Q60 100 70 125 Q100 115 130 125 Q140 100 122 70`}
        fill={INK}
        opacity="0.45"
      />
    );
  }

  if (kit === "stinger") {
    return (
      <path
        d="M155 88 L188 78 L162 100 Z"
        fill={INK}
      />
    );
  }

  if (kit === "antenna") {
    return (
      <g fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round">
        <path d="M88 42 Q80 22 74 18" />
        <path d="M112 42 Q120 22 126 18" />
        <circle cx="74" cy="16" r="3" fill={PAPER} stroke="none" />
        <circle cx="126" cy="16" r="3" fill={PAPER} stroke="none" />
      </g>
    );
  }

  if (kit === "tie") {
    return (
      <g fill={FACE}>
        <polygon points="100,72 107,79 100,112 93,79" opacity="0.95" />
      </g>
    );
  }

  if (kit === "badge") {
    return (
      <g>
        <circle cx="128" cy="88" r="9" fill={FACE} opacity="0.95" />
        <circle cx="128" cy="88" r="4.5" fill={INK} opacity="0.55" />
      </g>
    );
  }

  if (kit === "briefcase") {
    return (
      <g fill={INK}>
        <rect x="148" y="100" width="22" height="16" rx="2" opacity="0.85" />
        <rect x="155" y="96" width="8" height="5" rx="1" fill={PAPER} opacity="0.5" />
      </g>
    );
  }

  if (kit === "glitchbits") {
    return (
      <g fill={INK} opacity="0.55">
        <rect x="36" y="48" width="14" height="4" />
        <rect x="160" y="62" width="10" height="3" />
        <rect x="150" y="40" width="6" height="10" />
      </g>
    );
  }

  if (kit === "blush") {
    return (
      <g fill={FACE} opacity="0.4">
        <ellipse cx="72" cy="78" rx="9" ry="4.5" />
        <ellipse cx="128" cy="78" rx="9" ry="4.5" />
      </g>
    );
  }

  if (kit === "sparkles") {
    return (
      <g fill={FACE} opacity="0.85">
        <path d="M158 34 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" />
        <path d="M42 40 l1 3 3 1 -3 1 -1 3 -1 -3 -3 -1 3 -1z" />
      </g>
    );
  }

  return null;
}

function Limbs({
  genome,
  y = 108,
}: {
  genome: CreatureGenome;
  y?: number;
}) {
  const kit = genome.limbs;
  if (kit === "none") return null;

  if (kit === "floppy") {
    return (
      <g fill={INK} opacity="0.8">
        <ellipse cx="68" cy={y + 4} rx="14" ry="7" transform={`rotate(-18 68 ${y + 4})`} />
        <ellipse cx="132" cy={y + 6} rx="14" ry="7" transform={`rotate(22 132 ${y + 6})`} />
      </g>
    );
  }

  if (kit === "stubs") {
    return (
      <g fill={INK} opacity="0.85">
        <rect x="72" y={y} width="10" height={10 + genome.variant * 2} rx="3" />
        <rect x="118" y={y} width="10" height={10 + genome.variant * 2} rx="3" />
      </g>
    );
  }

  if (kit === "arms") {
    return (
      <g fill={INK} opacity="0.85">
        <rect x="48" y={y - 18} width="12" height={22 + genome.variant * 2} rx="4" transform={`rotate(-12 54 ${y - 8})`} />
        <rect x="140" y={y - 18} width="12" height={22 + genome.variant * 2} rx="4" transform={`rotate(12 146 ${y - 8})`} />
      </g>
    );
  }

  if (kit === "legs") {
    return (
      <g fill={INK} opacity="0.85">
        <rect x="82" y={y} width="10" height={16 + genome.variant} rx="2" />
        <rect x="108" y={y} width="10" height={16 + genome.variant} rx="2" />
      </g>
    );
  }

  // tendrils
  return (
    <g fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.65">
      <path d={`M70 ${y} q-10 12 -4 22`} />
      <path d={`M100 ${y + 4} q0 14 8 20`} />
      <path d={`M130 ${y} q12 10 6 22`} />
    </g>
  );
}

/* ─── Type sprites ────────────────────────────────────────── */

function LazySprite({ genome }: { genome: CreatureGenome }) {
  const hs = genome.headScale;
  const v = genome.variant;

  let body: ReactNode;
  if (genome.body === "loaf") {
    body = (
      <>
        <ellipse cx="100" cy="92" rx={58} ry={24 + v} {...BODY_STROKE} />
        <ellipse cx={78} cy={68} rx={28 * hs} ry={20 * hs} {...BODY_STROKE} />
      </>
    );
  } else if (genome.body === "puddle") {
    body = (
      <>
        <ellipse cx="100" cy="98" rx={64} ry={18} {...BODY_STROKE} />
        <ellipse cx="92" cy="72" rx={36 * hs} ry={26 * hs} {...BODY_STROKE} />
      </>
    );
  } else {
    body = (
      <>
        <ellipse cx="100" cy="88" rx={50 + v * 2} ry={32} {...BODY_STROKE} />
        <ellipse cx={85} cy={62} rx={30 * hs} ry={24 * hs} {...BODY_STROKE} />
      </>
    );
  }

  return (
    <g fill={INK}>
      {genome.accessory === "pillow" || genome.accessory === "haze" ? (
        <Accessory kit={genome.accessory} genome={genome} anchorY={30} />
      ) : null}
      {body}
      <PatternOverlay
        kit={genome.pattern}
        cx={90}
        cy={80}
        rx={40}
        ry={28}
        seed={genome.seed}
      />
      <Limbs genome={genome} y={104} />
      <Eyes
        kit={genome.eye}
        lx={72}
        ly={64}
        rx={96}
        ry={66}
        size={genome.eyeSize}
        spread={genome.eyeSpread}
        pupil={genome.pupilShift}
      />
      <Mouth kit={genome.mouth} cx={88} cy={78} w={20} />
      {genome.accessory !== "pillow" && genome.accessory !== "haze" ? (
        <Accessory kit={genome.accessory} genome={genome} anchorY={30} />
      ) : null}
    </g>
  );
}

function VagueSprite({ genome }: { genome: CreatureGenome }) {
  const hs = genome.headScale;
  const soft = 0.55 + genome.glow * 0.15;

  return (
    <g fill={INK}>
      {genome.accessory === "haze" ? (
        <Accessory kit={genome.accessory} genome={genome} anchorY={28} />
      ) : null}
      {/* layered soft silhouette — still readable as one form */}
      <ellipse cx="100" cy="78" rx={52 * genome.bodyW} ry={36} opacity={soft * 0.55} {...BODY_STROKE} />
      <ellipse
        cx={96 + (genome.variant - 1.5) * 4}
        cy="72"
        rx={40 * hs}
        ry={30 * hs}
        opacity={soft * 0.75}
        {...BODY_STROKE}
      />
      <ellipse cx="108" cy="80" rx={28} ry={22} opacity={soft * 0.45} {...BODY_STROKE} />
      {genome.body === "orb" ? (
        <ellipse cx="100" cy="74" rx={34 * hs} ry={34 * hs} opacity={soft} {...BODY_STROKE} />
      ) : null}
      <PatternOverlay
        kit={genome.pattern}
        cx={100}
        cy={74}
        rx={36}
        ry={28}
        seed={genome.seed}
      />
      <Limbs genome={genome} y={102} />
      <Eyes
        kit={genome.eye}
        lx={86}
        ly={70}
        rx={114}
        ry={72}
        size={genome.eyeSize * 0.9}
        spread={genome.eyeSpread}
        pupil={genome.pupilShift}
      />
      <Mouth kit={genome.mouth} cx={100} cy={88} w={18} />
      {genome.accessory !== "haze" ? (
        <Accessory kit={genome.accessory} genome={genome} anchorY={28} />
      ) : null}
    </g>
  );
}

function PanicSprite({ genome }: { genome: CreatureGenome }) {
  const v = genome.variant;
  const spikePts = [
    [100, 22 - v],
    [118, 48],
    [150, 40],
    [138, 70],
    [172, 86],
    [136, 96],
    [148, 124],
    [100, 108],
    [52, 124],
    [64, 96],
    [28, 86],
    [62, 70],
    [50, 40],
    [82, 48],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  let body: ReactNode;
  if (genome.body === "star") {
    body = (
      <polygon
        points="100,14 116,48 156,48 124,72 136,112 100,88 64,112 76,72 44,48 84,48"
        {...BODY_STROKE}
      />
    );
  } else if (genome.body === "jag") {
    body = (
      <path
        d="M100 20 L134 42 L162 34 L148 68 L180 92 L142 100 L152 130 L100 112 L48 130 L58 100 L20 92 L52 68 L38 34 L66 42 Z"
        {...BODY_STROKE}
      />
    );
  } else {
    body = <polygon points={spikePts} {...BODY_STROKE} />;
  }

  return (
    <g fill={INK}>
      {body}
      <PatternOverlay
        kit={genome.pattern}
        cx={100}
        cy={78}
        rx={40}
        ry={36}
        seed={genome.seed}
      />
      <Limbs genome={genome} y={112} />
      <Eyes
        kit={genome.eye}
        lx={82}
        ly={72}
        rx={118}
        ry={72}
        size={genome.eyeSize * 1.1}
        spread={genome.eyeSpread}
        pupil={genome.pupilShift}
      />
      <Mouth kit={genome.mouth} cx={100} cy={96} w={24} />
      <Accessory kit={genome.accessory} genome={genome} anchorY={28} />
    </g>
  );
}

function OverconfidentSprite({ genome }: { genome: CreatureGenome }) {
  const hs = genome.headScale;
  const chestRy = 36 + genome.variant * 2;

  return (
    <g fill={INK}>
      {genome.accessory === "cape" ? (
        <Accessory kit={genome.accessory} genome={genome} anchorY={22} />
      ) : null}
      {genome.body === "hero" ? (
        <>
          <ellipse cx="100" cy="42" rx={24 * hs} ry={22 * hs} {...BODY_STROKE} />
          <ellipse cx="100" cy="90" rx={42} ry={chestRy + 2} {...BODY_STROKE} />
          <polygon points="100,56 110,80 90,80" fill={FACE} opacity="0.45" />
        </>
      ) : genome.body === "puff" ? (
        <>
          <circle cx="100" cy="42" r={22 * hs} {...BODY_STROKE} />
          <ellipse cx="100" cy="88" rx={50} ry={36} {...BODY_STROKE} />
        </>
      ) : (
        <>
          <ellipse cx="100" cy="40" rx={22 * hs} ry={20 * hs} {...BODY_STROKE} />
          <ellipse cx="100" cy="86" rx={46} ry={chestRy + 2} {...BODY_STROKE} />
        </>
      )}
      <PatternOverlay
        kit={genome.pattern}
        cx={100}
        cy={86}
        rx={32}
        ry={28}
        seed={genome.seed}
      />
      <Limbs genome={genome} y={116} />
      <Eyes
        kit={genome.eye}
        lx={88}
        ly={40}
        rx={112}
        ry={40}
        size={genome.eyeSize}
        spread={genome.eyeSpread}
        pupil={genome.pupilShift}
      />
      <Mouth kit={genome.mouth} cx={100} cy={52} w={20} />
      {genome.accessory !== "cape" ? (
        <Accessory kit={genome.accessory} genome={genome} anchorY={22} />
      ) : null}
    </g>
  );
}

function PassiveSprite({ genome }: { genome: CreatureGenome }) {
  const hs = genome.headScale;

  return (
    <g fill={INK}>
      {genome.body === "wedge" ? (
        <path d="M40 90 L100 36 L160 90 Q130 118 100 118 Q70 118 40 90 Z" {...BODY_STROKE} />
      ) : genome.body === "drop" ? (
        <path
          d="M100 28 C140 28 162 70 150 100 C138 122 62 122 50 100 C38 70 60 28 100 28 Z"
          {...BODY_STROKE}
        />
      ) : (
        <path
          d="M36 88c0-28 28-52 64-52s64 24 64 52c0 8-6 14-18 18-20 8-52 8-72 0-12-4-18-10-18-18z"
          {...BODY_STROKE}
        />
      )}
      <PatternOverlay
        kit={genome.pattern}
        cx={100}
        cy={78}
        rx={44}
        ry={30}
        seed={genome.seed}
      />
      <Limbs genome={genome} y={108} />
      <Eyes
        kit={genome.eye}
        lx={80}
        ly={72}
        rx={118}
        ry={74}
        size={genome.eyeSize * hs}
        spread={genome.eyeSpread}
        pupil={genome.pupilShift + 1.5}
      />
      <Mouth kit={genome.mouth} cx={100} cy={92} w={26} />
      <Accessory kit={genome.accessory} genome={genome} anchorY={34} />
    </g>
  );
}

function CorporateSprite({ genome }: { genome: CreatureGenome }) {
  const hw = 50 + genome.variant * 3;
  const bw = 64 + genome.bodyW * 6;
  const hh = 36 * genome.headScale;

  return (
    <g fill={INK}>
      {genome.body === "badge" ? (
        <>
          <rect x={100 - hw / 2} y={32} width={hw} height={hh} rx="3" {...BODY_STROKE} />
          <path
            d={`M${100 - bw / 2} 70 L${100 + bw / 2} 70 L${100 + bw / 2 - 6} 118 L${100 - bw / 2 + 6} 118 Z`}
            {...BODY_STROKE}
          />
        </>
      ) : genome.body === "brick" ? (
        <>
          <rect x={100 - hw / 2} y={30} width={hw} height={hh} rx="1" {...BODY_STROKE} />
          <rect x={100 - bw / 2} y={68} width={bw} height={48} rx="1" {...BODY_STROKE} />
          <line
            x1={100 - bw / 2}
            y1={92}
            x2={100 + bw / 2}
            y2={92}
            stroke={FACE}
            strokeWidth="1.2"
            opacity="0.35"
          />
        </>
      ) : (
        <>
          <rect x={100 - hw / 2} y={28} width={hw} height={hh} rx="2" {...BODY_STROKE} />
          <rect x={100 - bw / 2} y={66} width={bw} height={50} rx="2" {...BODY_STROKE} />
        </>
      )}
      <PatternOverlay
        kit={genome.pattern}
        cx={100}
        cy={90}
        rx={bw / 2 - 4}
        ry={20}
        seed={genome.seed}
      />
      <Limbs genome={genome} y={116} />
      <Eyes
        kit={genome.eye}
        lx={100 - hw * 0.22}
        ly={28 + hh * 0.45}
        rx={100 + hw * 0.22}
        ry={28 + hh * 0.45}
        size={genome.eyeSize}
        spread={1}
        pupil={genome.pupilShift}
      />
      <Mouth kit={genome.mouth} cx={100} cy={28 + hh * 0.72} w={14} />
      <Accessory kit={genome.accessory} genome={genome} anchorY={24} />
    </g>
  );
}

function ChaoticSprite({ genome }: { genome: CreatureGenome }) {
  const hs = genome.headScale;
  const off = (genome.variant - 1.5) * 6;

  return (
    <g fill={INK}>
      {genome.body === "lopsided" ? (
        <>
          <ellipse cx={88 + off} cy="70" rx={38 * hs} ry={34} {...BODY_STROKE} />
          <ellipse cx={118} cy="82" rx={28} ry={26} {...BODY_STROKE} />
          <ellipse cx={70} cy="48" rx={14} ry={18} {...BODY_STROKE} />
          <ellipse cx={130} cy="52" rx={10} ry={22} {...BODY_STROKE} />
        </>
      ) : genome.body === "shard" ? (
        <path d={`M${60 + off} 100 L90 30 L130 48 L155 90 L120 120 L70 118 Z`} {...BODY_STROKE} />
      ) : (
        <>
          <ellipse cx="100" cy="76" rx={40} ry={34} {...BODY_STROKE} />
          <rect x={48 + off} y="58" width="18" height="12" rx="1" fill={INK} opacity="0.9" />
          <rect x="140" y="70" width="14" height="8" rx="1" fill={INK} opacity="0.75" />
          <ellipse cx={75} cy="46" rx={12} ry={16} {...BODY_STROKE} />
          <circle cx={128} cy="44" r={10} {...BODY_STROKE} />
        </>
      )}
      <PatternOverlay
        kit={genome.pattern}
        cx={100}
        cy={78}
        rx={36}
        ry={28}
        seed={genome.seed}
      />
      <Limbs genome={genome} y={110} />
      <Eyes
        kit={genome.eye}
        lx={78}
        ly={68}
        rx={120}
        ry={74}
        size={genome.eyeSize}
        spread={genome.eyeSpread}
        pupil={genome.pupilShift}
      />
      <Mouth kit={genome.mouth} cx={98} cy={92} w={22} />
      <Accessory kit={genome.accessory} genome={genome} anchorY={26} />
    </g>
  );
}

function EmojiSprite({ genome }: { genome: CreatureGenome }) {
  const r = 38 + genome.headScale * 6 + genome.variant;

  return (
    <g fill={INK}>
      {genome.body === "bean" ? (
        <ellipse cx="100" cy="72" rx={r * 0.85} ry={r * 1.05} {...BODY_STROKE} />
      ) : genome.body === "moon" ? (
        <path
          d={`M${100 + r * 0.15} ${72 - r * 0.9}
            A${r} ${r} 0 1 0 ${100 + r * 0.15} ${72 + r * 0.9}
            A${r * 0.7} ${r * 0.7} 0 1 1 ${100 + r * 0.15} ${72 - r * 0.9}
            Z`}
          {...BODY_STROKE}
        />
      ) : (
        <circle cx="100" cy="72" r={r} {...BODY_STROKE} />
      )}
      <PatternOverlay
        kit={genome.pattern}
        cx={100}
        cy={78}
        rx={r * 0.6}
        ry={r * 0.5}
        seed={genome.seed}
      />
      <Limbs genome={genome} y={72 + r - 4} />
      <Eyes
        kit={genome.eye}
        lx={82}
        ly={64}
        rx={118}
        ry={64}
        size={genome.eyeSize}
        spread={genome.eyeSpread}
        pupil={genome.pupilShift}
      />
      <Mouth kit={genome.mouth} cx={100} cy={88} w={32} />
      <Accessory kit={genome.accessory} genome={genome} anchorY={28} />
    </g>
  );
}
