import assert from "node:assert/strict";
import test from "node:test";
import { clampCardName } from "../lib/classify.ts";
import { normalizeProfile } from "../lib/classify-profile.ts";

const sparseCommits = [
  { message: "fix docs", committedAt: "2026-09-01T12:00:00.000Z", repo: "demo/one" },
  { message: "fix typo", committedAt: "2026-09-02T12:00:00.000Z", repo: "demo/one" },
  { message: "fix links", committedAt: "2026-09-03T12:00:00.000Z", repo: "demo/one" },
];

test("sparse histories keep their single evidence-backed prediction", () => {
  const profile = normalizeProfile(
    {
      dominant_type: "corporate",
      persona_title: "The Documentation Mechanic",
      stats: { clarity: 80, effort: 80, honesty: 90, chaos: 12 },
      predictions: [
        {
          category: "coding_ritual",
          title: "The Fixing Ritual",
          text: "Every typo gets another ceremonial fix before the links may leave.",
        },
      ],
    },
    sparseCommits,
  );

  assert.equal(profile.predictions.length, 1);
  assert.equal(profile.predictions[0]?.category, "coding_ritual");
});

test("a profile with no evidence-backed prediction remains invalid", () => {
  assert.throws(
    () => normalizeProfile({ predictions: [] }, sparseCommits),
    /no evidence-backed predictions/i,
  );
});

test("card names are letters-only and stay within the display cap", () => {
  assert.equal(clampCardName("Bug-Fix_9000!"), "bugfix");
  assert.equal(clampCardName("Caf\u00e9 Phantom"), "cafephantom");
  assert.equal(clampCardName("a very long specimen name"), "averylongspec");
});
