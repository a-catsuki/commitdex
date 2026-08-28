import { predictionCategoryPromptList } from "./prediction-icons";

export const CARD_SYSTEM_PROMPT = `Mint one collectible creature from THIS git commit. JSON only.

name: one lowercase, letters-only species name, 5–13 characters, no spaces or punctuation. Make it evocative, pronounceable, and creature-like: a rhythmic 2–4 syllable name with an unusual consonant/vowel shape that could belong in a bestiary. Read the whole commit and choose one specific semantic hook from its emotional energy, imagery, key concept, or type; reflect that hook subtly rather than spelling out the message. One clever mutation or invented root is welcome. Do not mechanically concatenate two or more full source words, do not merely truncate source text, and do not name it after the first two words. The name should feel intentional and unique to THIS message.

Type-aware phonetic flavor: lazy=soft, slumped, cozy, or syrupy sounds; vague=airy, uncertain, misty sounds; panic=sharp, urgent, crackling sounds; overconfident=regal, heavy, grandiose sounds; passive-aggressive=polished but barbed sounds; corporate=clipped, industrial, official sounds; chaotic=asymmetric and unpredictable but still pronounceable sounds; emoji=expressive, light, symbolic sounds. Say the name aloud. If it sounds like a variable, filename, error code, or random word mash, revise it. Ban generic placeholders like missingno, commitmon, glitch, blob, and sprite; ban famous/canned creature names and stock suffixes like -odile, -scream, -geist, -puff, -zard, -sting, -bot, and -moji.

type: exactly one of lazy | vague | panic | overconfident | passive-aggressive | corporate | chaotic | emoji. Justify from the writing, never at random. lazy=generic verbs/minimal effort. vague=does not say what changed. panic=caps, please, desperation. overconfident=promises the world. passive-aggressive=subtext at a person. corporate=jargon/performance-review tone. chaotic=noise, smash, unhinged. emoji=mostly pictographs.

flavor_text: a Pokedex-style roast ABOUT the commit's energy and meaning — not a paraphrase, quote dump, or "Creature says: {message}". Third person. Aim for 1–2 punchy complete sentences (a short third is ok if both land). Funny and type-appropriate: lazy=bored shrug, panic=frantic sweat, corporate=HR-speak, vague=foggy shrug, overconfident=sales pitch, passive-aggressive=polite knife, chaotic=unhinged field notes, emoji=pictograph anthropology. You may echo one short distinctive word for wit, but never restating the commit near-verbatim. No mid-thought cutoff. No wrapping essay. No generic type lecture that ignores THIS message.

stats 0–100 from the text: clarity=says what changed; effort=care in the writing; honesty=likely matches a real change (vague/overconfident score low); chaos=unhinged, unpredictable, or funny.

rarity: common=generic ("fix","update"); uncommon=a little personality; rare=genuinely funny or specific; legendary=structurally unusual (ALL CAPS, extremely short, or extremely long); shiny=bizarre outlier only (keyboard smash, DO NOT MERGE, one-offs).

No markdown. No commentary. No extra keys.`;

export const CARD_JSON_HINT = `{"name":"lowercase 5–13 character species name; pronounceable, rhythmic, semantic hook; no raw word concatenation","type":"lazy|vague|panic|overconfident|passive-aggressive|corporate|chaotic|emoji","rarity":"common|uncommon|rare|legendary|shiny","stats":{"clarity":0,"effort":0,"honesty":0,"chaos":0},"flavor_text":"1–2 punchy Pokedex roast sentences about the energy, not a restatement of the commit"}`;

export const PROFILE_SYSTEM_PROMPT = `Invent a trainer profile from one person's real git commit messages. JSON only.

persona_title: a short original epithet that could only fit THIS batch (messages + timing: nights, weekends, bursts). Do not use stock titles like "the midnight fixer" or "weekend diplomat".

dominant_type: exactly one of lazy, vague, panic, overconfident, passive-aggressive, corporate, chaotic, emoji. Must match the batch.

stats 0–100 (clarity, effort, honesty, chaos): spirit of the batch, not a literal mean.

predictions: exactly 3–5 items, each using a distinct category from this allowlist:
${predictionCategoryPromptList()}
Only choose categories supported by the commit batch. Never duplicate a category or invent evidence.

title: 2–6 words, an original funny title specific to its category, not a generic horoscope.

text: exactly one short sentence, about 8–16 words. Make the joke specific to observed commit words, timing, or patterns. The text itself must provide the grounding, with no evidence field.

icon: optional decorative slug. If present, use only the category's mapped icon. Never invent other ti-* names.

Use playful "will probably..." framing, not factual claims about the person. Never infer sensitive traits or mention marriage, health, politics, finances, location, or identity. Ground the persona and predictions in the batch.

No markdown. No commentary.`;

export const PROFILE_JSON_HINT = `{"dominant_type":"lazy|vague|panic|overconfident|passive-aggressive|corporate|chaotic|emoji","persona_title":"short original epithet","stats":{"clarity":0,"effort":0,"honesty":0,"chaos":0},"predictions":[{"category":"song_on_repeat","title":"The Fix-Commit Mixtape","icon":"ti-music","text":"Will probably replay every fix commit until the deploy chorus finally lands."}]}`;
