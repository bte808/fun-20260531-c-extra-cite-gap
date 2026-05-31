import test from "node:test";
import assert from "node:assert/strict";
import {
  SAMPLE_DRAFT,
  SAMPLE_REFERENCES,
  analyzeCitationGaps,
  extractCitationGroups,
  extractReferenceKeys,
  normalizeKey
} from "../src/citeGap.js";

test("normalizes citation keys without punctuation or leading at sign", () => {
  assert.equal(normalizeKey("@Smith2024,"), "smith2024");
});

test("extracts LaTeX and Pandoc citation groups", () => {
  const groups = extractCitationGroups("A claim \\citep{smith2024,Lee-2025}. Another [@doe2026; @roe2027].");
  assert.deepEqual(groups.flatMap((group) => group.keys), ["smith2024", "Lee-2025", "doe2026", "roe2027"]);
});

test("extracts BibTeX, Markdown, and id reference keys", () => {
  const keys = extractReferenceKeys(`@article{smith2024,\n}\n- [lee2025] Lee note\nid: doe2026`);
  assert.deepEqual(keys, ["smith2024", "lee2025", "doe2026"]);
});

test("finds missing references and unused bibliography keys", () => {
  const result = analyzeCitationGaps("One supported point \\cite{have2024}. One gap \\cite{missing2026}.", "@article{have2024,\n}\n- [unused2022] note");
  assert.deepEqual(result.missingReferences, ["missing2026"]);
  assert.deepEqual(result.unusedReferences, ["unused2022"]);
  assert.equal(result.nextReviewMove.title, "Repair missing reference keys");
  assert.match(result.markdown, /Next Review Move/);
});

test("flags claim-like sentences that do not contain source markers", () => {
  const draft = "This method improves retention by 24 percent across 80 participants in a synthetic classroom note.";
  const result = analyzeCitationGaps(draft, "");
  assert.equal(result.citationNeeded.length, 1);
  assert.equal(result.citationNeeded[0].reason, "numeric claim");
  assert.equal(result.nextReviewMove.title, "Source-check the strongest claim cue");
});

test("sample produces an actionable audit report", () => {
  const result = analyzeCitationGaps(SAMPLE_DRAFT, SAMPLE_REFERENCES);
  assert.equal(result.stats.missingReferences, 1);
  assert.equal(result.stats.unusedReferences, 1);
  assert.match(result.markdown, /Citation Gap Audit/);
  assert.match(result.markdown, /missing2026/);
});
