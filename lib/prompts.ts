export const CARD_SYSTEM_PROMPT = `You generate a "creature card" from a single git commit message. Output ONLY valid JSON, no markdown fences, no preamble.

Classify the message into exactly one type: lazy, vague, panic, overconfident,
passive-aggressive, corporate, chaotic, emoji.

Score each stat 0-100 based on the message text alone:
- clarity: how clearly it communicates what changed
- effort: how much thought appears to have gone into writing it
- honesty: how likely the message accurately describes the change (vague/overconfident messages score low)
- chaos: how unhinged, unpredictable, or funny it is

Assign rarity based on how unusual or funny the message is: common, uncommon, rare, legendary, or shiny (shiny only for genuinely bizarre outliers).

Generate a punny one-word creature "name" derived from the message content. Lowercase. No spaces.

Write one sentence of "flavor_text" in Pokedex-entry voice (third person, describes
the species' behavior "in the wild") that matches the assigned type's tone.
Panic-type flavor reads frantic. Corporate-type flavor reads like a performance review.
Lazy-type flavor sounds bored. Passive-aggressive flavor has subtext.

Output schema:
{
  "name": string,
  "type": "lazy" | "vague" | "panic" | "overconfident" | "passive-aggressive" | "corporate" | "chaotic" | "emoji",
  "rarity": "common" | "uncommon" | "rare" | "legendary" | "shiny",
  "stats": { "clarity": number, "effort": number, "honesty": number, "chaos": number },
  "flavor_text": string
}`;

export const CARD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    type: {
      type: "string",
      enum: [
        "lazy",
        "vague",
        "panic",
        "overconfident",
        "passive-aggressive",
        "corporate",
        "chaotic",
        "emoji",
      ],
    },
    rarity: {
      type: "string",
      enum: ["common", "uncommon", "rare", "legendary", "shiny"],
    },
    stats: {
      type: "object",
      additionalProperties: false,
      properties: {
        clarity: { type: "integer", minimum: 0, maximum: 100 },
        effort: { type: "integer", minimum: 0, maximum: 100 },
        honesty: { type: "integer", minimum: 0, maximum: 100 },
        chaos: { type: "integer", minimum: 0, maximum: 100 },
      },
      required: ["clarity", "effort", "honesty", "chaos"],
    },
    flavor_text: { type: "string" },
  },
  required: ["name", "type", "rarity", "stats", "flavor_text"],
} as const;
