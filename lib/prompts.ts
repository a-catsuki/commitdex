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

export const PROFILE_SYSTEM_PROMPT = `Invent a trainer profile from one person's real git commit messages and timestamps. JSON only.

persona_title: a short original epithet that could only fit THIS batch (messages + timing: nights, weekends, bursts). Do not use stock titles like "the midnight fixer" or "weekend diplomat".

dominant_type: exactly one of lazy, vague, panic, overconfident, passive-aggressive, corporate, chaotic, emoji. Must match the batch.

stats 0–100 (clarity, effort, honesty, chaos): spirit of the batch, not a literal mean.

predictions: return 1–5 items, each using a distinct category from this allowlist. Aim for 3–5 only when the commit batch supports that many evidence lanes:
${predictionCategoryPromptList()}
Only choose categories supported by explicit evidence in this commit batch. Omit a category when its evidence lane is absent—even when that leaves fewer than three predictions. Never duplicate a category, invent evidence, or turn a broad vibe into a category.

Category contracts (these are hard boundaries):
- cafe_order / CAFÉ ORDER: one specific drink, order, or customization inferred ONLY from drink, cafe, or caffeine evidence. The title names that order; the punchline jokes about that order.
- sleep_schedule / SLEEP SCHEDULE: a time-of-day or day pattern proven by commit timestamps. The title names the schedule; the punchline jokes about when commits appear.
- desk_artifact / DESK ARTIFACT: one concrete object or tool explicitly suggested by a message, such as a cable, keyboard, monitor, or sticky note. The title names that object; the punchline jokes about its role.
- coding_ritual / CODING RITUAL: a repeated commit verb or workflow such as fix, deploy, refactor, WIP, or hotfix. The title names the ritual; the punchline jokes about the repeated behavior.
- communication_style / COMMUNICATION STYLE: an actual linguistic pattern such as all-caps, terse, apologetic, vague, or passive-aggressive wording. The title names the style; the punchline jokes about that wording.
- commit_crime / COMMIT CRIME: one specific funny offense visible in a commit, such as mass deletion, "final final", or a broken deploy. The title names the offense; the punchline jokes about the act.
- weekend_protocol / WEEKEND PROTOCOL: Saturday/Sunday commit activity only when timestamps support it. The title names the weekend behavior; the punchline jokes about it.
- song_on_repeat / SONG ON REPEAT: a fictional soundtrack, genre, song, album, or playlist concept based on repeated words, timing, or commit energy. The title must sound song/album/playlist-like; the punchline jokes about that soundtrack. Never claim real listening history.

STRICT SAME-SUBJECT TEST: each prediction is one concrete subject. Its category, title, and punchline must all refer to that same subject. The punchline must mention or echo evidence from the commits. If the title is "The Charging Cable", the text must joke about a charging cable, not midnight deploys. Before returning each item, ask: "Could this punchline be attached to this title without changing the subject?" If not, rewrite it or omit the category.

title: 2–6 words, concrete and category-specific. Name the order, schedule, object, ritual, style, offense, weekend behavior, or fictional soundtrack—not a generic horoscope.

text: exactly one short, complete sentence, about 8–16 words. Make it funny and grounded in observed commit words, timestamps, or patterns. Avoid canned "will probably..." horoscope filler; playful framing is welcome when the joke stays specific.

icon: optional decorative slug. If present, use only the mapped icon for that category. Never invent other ti-* names.

Use playful framing, never factual or sensitive claims. Do not infer or mention marriage, health, politics, finances, location, or identity. Do not claim facts outside the batch.

Good examples for structure only—do not copy them:
{"category":"cafe_order","title":"The Oat Milk Cortado","text":"Every fix gets an oat-milk upgrade before this order ships."}
{"category":"song_on_repeat","title":"The Hotfix Encore","text":"Repeated hotfixes get a louder chorus whenever midnight rolls around."}

No markdown. No commentary.`;

export const PROFILE_JSON_HINT = `{"dominant_type":"lazy|vague|panic|overconfident|passive-aggressive|corporate|chaotic|emoji","persona_title":"short original epithet","stats":{"clarity":0,"effort":0,"honesty":0,"chaos":0},"predictions":[{"category":"song_on_repeat","title":"The Hotfix Encore","icon":"ti-music","text":"Repeated hotfixes get a louder chorus whenever midnight rolls around."}]}`;
