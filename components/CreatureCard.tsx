"use client";

import { forwardRef, type CSSProperties } from "react";
import { CreatureArt } from "@/components/CreatureArt";
import { RARITY_LABEL, TYPE_META } from "@/lib/type-meta";
import type { CreatureCard as CardData } from "@/lib/types";

const STATS = ["clarity", "effort", "honesty", "chaos"] as const;

type Props = {
  card: CardData;
};

export const CreatureCard = forwardRef<HTMLElement, Props>(function CreatureCard(
  { card },
  ref,
) {
  const meta = TYPE_META[card.type];

  return (
    <article
      ref={ref}
      className="dex-card"
      data-type={card.type}
      data-rarity={card.rarity}
      style={
        {
          "--card-ink": `var(${meta.cssVar})`,
          "--card-paper": `var(${meta.paperVar})`,
        } as CSSProperties
      }
    >
      <header className="dex-card__head">
        <h2 className="dex-card__name">{card.name}</h2>
        <p className="dex-card__rarity">{RARITY_LABEL[card.rarity]}</p>
      </header>

      <p className="dex-card__type">
        <span className="type-chip type-chip--on-card">{meta.label}</span>
        <span className="dex-card__type-word">type</span>
      </p>

      <div className="dex-card__art">
        <CreatureArt
          type={card.type}
          name={card.name}
          rarity={card.rarity}
          originalMessage={card.original_message}
        />
        {card.rarity === "shiny" ? (
          <span className="dex-card__sparkles" aria-hidden="true" />
        ) : null}
      </div>

      <p className="dex-card__flavor">{card.flavor_text}</p>

      <dl className="dex-card__stats">
        {STATS.map((stat) => (
          <div key={stat} className="dex-stat">
            <dt>{stat}</dt>
            <dd>
              <span className="dex-stat__track" aria-hidden="true">
                <span
                  className="dex-stat__fill"
                  style={{ "--v": card.stats[stat] } as CSSProperties}
                />
              </span>
              <span className="dex-stat__n">{card.stats[stat]}</span>
            </dd>
          </div>
        ))}
      </dl>

      <blockquote className="dex-card__msg">
        <span className="dex-card__msg-label">original message</span>
        {card.original_message}
      </blockquote>
    </article>
  );
});
