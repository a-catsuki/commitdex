export const CARD_SYSTEM_PROMPT = `Mint one collectible creature from THIS git commit. JSON only.

name: one lowercase invented word, no spaces, 13 characters max. Pun or portmanteau of words that actually appear in this commit so the message is still audible in the name. Must reuse letter chunks from at least two distinct words in the commit (or the only word, if it is a single token). Unique to this message. Ban suffixes -odile -scream -geist -puff -zard -sting -bot -moji. Ban stock names fixodile pleascream asdfgeist updatoth wipuff stufflax. Ban generic unused words like glitch, blob, sprite. If the pun wants to run long, compress it to 13 letters instead of padding a canned suffix.

type: exactly one of lazy | vague | panic | overconfident | passive-aggressive | corporate | chaotic | emoji. Justify from the writing, never at random. lazy=generic verbs/minimal effort. vague=does not say what changed. panic=caps, please, desperation. overconfident=promises the world. passive-aggressive=subtext at a person. corporate=jargon/performance-review tone. chaotic=noise, smash, unhinged. emoji=mostly pictographs.

flavor_text: a Pokedex-style roast ABOUT the commit's energy and meaning — not a paraphrase, quote dump, or "Creature says: {message}". Third person. Aim for 1–2 punchy complete sentences (a short third is ok if both land). Funny and type-appropriate: lazy=bored shrug, panic=frantic sweat, corporate=HR-speak, vague=foggy shrug, overconfident=sales pitch, passive-aggressive=polite knife, chaotic=unhinged field notes, emoji=pictograph anthropology. You may echo one short distinctive word for wit, but never restating the commit near-verbatim. No mid-thought cutoff. No wrapping essay. No generic type lecture that ignores THIS message.

stats 0–100 from the text: clarity=says what changed; effort=care in the writing; honesty=likely matches a real change (vague/overconfident score low); chaos=unhinged, unpredictable, or funny.

rarity: common=generic ("fix","update"); uncommon=a little personality; rare=genuinely funny or specific; legendary=structurally unusual (ALL CAPS, extremely short, or extremely long); shiny=bizarre outlier only (keyboard smash, DO NOT MERGE, one-offs).

No markdown. No commentary. No extra keys.`;

export const CARD_JSON_HINT = `{"name":"lowercase portmanteau, max 13 chars","type":"lazy|vague|panic|overconfident|passive-aggressive|corporate|chaotic|emoji","rarity":"common|uncommon|rare|legendary|shiny","stats":{"clarity":0,"effort":0,"honesty":0,"chaos":0},"flavor_text":"1–2 punchy Pokedex roast sentences about the energy, not a restatement of the commit"}`;

export const PROFILE_SYSTEM_PROMPT = `Invent a trainer profile from one person's real git commit messages. JSON only.

persona_title: a short original epithet that could only fit THIS batch (messages + timing: nights, weekends, bursts). Do not use stock titles like "the midnight fixer" or "weekend diplomat".

dominant_type: exactly one of lazy, vague, panic, overconfident, passive-aggressive, corporate, chaotic, emoji. Must match the batch.

stats 0–100 (clarity, effort, honesty, chaos): spirit of the batch, not a literal mean.

predictions: 3–5 short funny punchlines (one line each, ~8–14 words). Not a horoscope. Ground each joke in this batch — verbs, timing (night/weekend/burst), message patterns, or named quirks that actually appear. No generic "you work hard" / zodiac filler.

icon: MUST be exactly one allowlisted slug, chosen for meaning (not decoration): ti-coffee (CAFFEINE), ti-moon (LATE NIGHTS), ti-keyboard (KEYSMASH), ti-bolt (BURST), ti-clock (CLOCKWATCH), ti-flame (ON FIRE), ti-briefcase (CORP SPEAK), ti-ghost (GHOSTED), ti-rocket (OVERCOMMIT), ti-mood-smile (PICTOGRAPH). Never invent other ti-* names.

Ground persona and at least one prediction in something that actually appears in the batch.

No markdown. No commentary.`;

export const PROFILE_JSON_HINT = `{"dominant_type":"lazy|vague|panic|overconfident|passive-aggressive|corporate|chaotic|emoji","persona_title":"short original epithet","stats":{"clarity":0,"effort":0,"honesty":0,"chaos":0},"predictions":[{"icon":"ti-moon","text":"3am fix commits, still shipping typos"}]}`;
