import { CreatureCard } from "@/components/CreatureCard";
import type { CreatureCard as CardData, CreatureType, Rarity } from "@/lib/types";

function card(
  name: string,
  type: CreatureType,
  message: string,
  rarity: Rarity = "uncommon",
): CardData {
  return {
    name,
    type,
    rarity,
    stats: { clarity: 40, effort: 35, honesty: 50, chaos: 45 },
    flavor_text: "Art lab specimen.",
    original_message: message,
    source: "openrouter",
    model: "lab",
  };
}

const ROWS: { type: CreatureType; samples: [string, string, string] }[] = [
  { type: "lazy", samples: ["fix stuff", "wip nap", "later maybe"] },
  { type: "vague", samples: ["changes", "update things", "misc"] },
  { type: "panic", samples: ["PLEASE WORK", "hotfix asap!!", "breaking prod"] },
  {
    type: "overconfident",
    samples: ["fixed everything", "final version I swear", "perfect now"],
  },
  {
    type: "passive-aggressive",
    samples: ["fixed the bug THEY caused", "as discussed", "per your request"],
  },
  {
    type: "corporate",
    samples: [
      "resolved issue pertaining to auth flow",
      "aligned stakeholders",
      "synergized modules",
    ],
  },
  { type: "chaotic", samples: ["asdfasdf", "!!!??", "yoink yeet"] },
  { type: "emoji", samples: ["🔥🔥🔥", "✨ ship ✨", "🐛→✅"] },
];

export default function ArtLabPage() {
  return (
    <main
      style={{
        padding: "24px",
        display: "grid",
        gap: "32px",
        background: "oklch(12% 0.02 145)",
        minHeight: "100dvh",
      }}
    >
      <h1 style={{ color: "oklch(88% 0.04 145)", fontFamily: "monospace" }}>
        Creature art lab
      </h1>
      {ROWS.map((row) => (
        <section key={row.type} style={{ display: "grid", gap: "12px" }}>
          <h2
            style={{
              color: "oklch(78% 0.06 145)",
              fontFamily: "monospace",
              fontSize: "14px",
              textTransform: "uppercase",
            }}
          >
            {row.type} — same type, different messages
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {row.samples.map((msg, i) => (
              <CreatureCard
                key={msg}
                card={card(`${row.type}-${i + 1}`, row.type, msg, i === 2 ? "rare" : "uncommon")}
              />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
