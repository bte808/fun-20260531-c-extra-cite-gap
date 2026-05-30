export const SAMPLE_DRAFT = `Lightweight draft example

Local-first reading notes help students keep fragile paper ideas close to the source, but scattered citation keys make review harder. Prior work in reproducible notebook practice often asks authors to keep code, data, and claims connected \\cite{rule2024}.

In a small lab discussion, teams that wrote one citation key beside each empirical claim found missing source context faster than teams that only kept a reference dump. This sentence is synthetic sample data, not a real study result.

Markdown writers can also use Pandoc-style keys such as [@smith2023; @lee2025] when drafting literature notes. A draft may accidentally cite \\citep{missing2026} or keep a bibliography entry that never appears in the text.`;

export const SAMPLE_REFERENCES = `@article{rule2024,
  title = {Synthetic notebook practice placeholder},
  author = {Rule, Ada},
  year = {2024}
}

- [smith2023] Smith, R. Synthetic source note for a reading workflow.
- [lee2025] Lee, M. Synthetic source note for Markdown citation testing.
- [unused2022] Unused sample reference kept here on purpose.`;

const LATEX_CITE_RE = /\\(?:cite|citep|citet|citealp|citealt|citeyear|citeauthor|autocite|parencite|textcite|footcite)(?:\s*\[[^\]]*]){0,2}\s*\{([^}]+)\}/gi;
const BRACKET_GROUP_RE = /\[([^\]\n]*@[A-Za-z0-9_.:-][^\]\n]*)]/g;
const BIBTEX_RE = /@\w+\s*\{\s*([^,\s}]+)\s*,/gi;
const MARKDOWN_REF_RE = /^\s*(?:[-*+]\s*)?\[@?([A-Za-z0-9_.:-]+)](?:\s+|:)/gm;
const KEYED_REF_RE = /^\s*@?([A-Za-z0-9_.:-]*\d[A-Za-z0-9_.:-]*)\s*(?::|-)\s+\S/gm;
const ID_REF_RE = /^\s*(?:id|key)\s*:\s*["']?([A-Za-z0-9_.:-]+)["']?\s*$/gmi;
const CLAIM_CUE_RE = /\b(shows?|suggests?|demonstrates?|indicates?|proves?|improves?|reduces?|increases?|decreases?|outperforms?|correlates?|causes?|significant|statistically|higher|lower|better|worse|effective|robust|novel|state-of-the-art|sota|accuracy|precision|recall|finding|results?|evidence)\b/i;
const NUMERIC_CLAIM_RE = /\b\d+(?:\.\d+)?\s*(?:%|percent|x|times|fold|participants|samples|papers|trials|datasets)\b/i;
const SOURCE_TOKEN_RE = /(https?:\/\/\S+|doi:\s*10\.\d{4,9}\/\S+|10\.\d{4,9}\/\S+)/i;

export function normalizeKey(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^[{[(]+|[}\]),.;:]+$/g, "")
    .toLowerCase();
}

export function extractCitationGroups(text) {
  const groups = [];
  const draft = String(text || "");
  let match;

  LATEX_CITE_RE.lastIndex = 0;
  while ((match = LATEX_CITE_RE.exec(draft))) {
    const keys = splitKeyList(match[1]);
    if (keys.length) {
      groups.push({
        style: "latex",
        raw: match[0],
        keys,
        index: match.index,
        end: match.index + match[0].length
      });
    }
  }

  BRACKET_GROUP_RE.lastIndex = 0;
  while ((match = BRACKET_GROUP_RE.exec(draft))) {
    const keys = Array.from(match[1].matchAll(/@([A-Za-z0-9_.:-]+)/g), (keyMatch) => keyMatch[1]);
    if (keys.length) {
      groups.push({
        style: "pandoc",
        raw: match[0],
        keys: dedupe(keys.map(cleanKey).filter(Boolean)),
        index: match.index,
        end: match.index + match[0].length
      });
    }
  }

  return groups.sort((a, b) => a.index - b.index);
}

export function extractReferenceKeys(text) {
  const references = String(text || "");
  const candidates = [];
  let match;

  BIBTEX_RE.lastIndex = 0;
  while ((match = BIBTEX_RE.exec(references))) {
    candidates.push(cleanKey(match[1]));
  }

  MARKDOWN_REF_RE.lastIndex = 0;
  while ((match = MARKDOWN_REF_RE.exec(references))) {
    candidates.push(cleanKey(match[1]));
  }

  KEYED_REF_RE.lastIndex = 0;
  while ((match = KEYED_REF_RE.exec(references))) {
    candidates.push(cleanKey(match[1]));
  }

  ID_REF_RE.lastIndex = 0;
  while ((match = ID_REF_RE.exec(references))) {
    candidates.push(cleanKey(match[1]));
  }

  return dedupe(candidates.filter(Boolean));
}

export function analyzeCitationGaps(draftText, referenceText) {
  const draft = String(draftText || "");
  const citationGroups = extractCitationGroups(draft);
  const citedKeys = dedupe(citationGroups.flatMap((group) => group.keys));
  const referenceKeys = extractReferenceKeys(referenceText);
  const citationMap = countBy(citedKeys.map(normalizeKey));
  const referenceCounts = countBy(referenceKeys.map(normalizeKey));
  const citedNormalized = new Set(citedKeys.map(normalizeKey));
  const referenceNormalized = new Set(referenceKeys.map(normalizeKey));

  const missingReferences = citedKeys.filter((key) => !referenceNormalized.has(normalizeKey(key)));
  const unusedReferences = referenceKeys.filter((key) => !citedNormalized.has(normalizeKey(key)));
  const duplicateBibliography = Object.entries(referenceCounts)
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
  const citationNeeded = findCitationNeededSentences(draft, citationGroups);
  const score = calculateScore({
    citedCount: citedKeys.length,
    missingCount: missingReferences.length,
    unusedCount: unusedReferences.length,
    neededCount: citationNeeded.length,
    duplicateCount: duplicateBibliography.length
  });

  const stats = {
    citationGroups: citationGroups.length,
    citedKeys: citedKeys.length,
    referenceKeys: referenceKeys.length,
    missingReferences: missingReferences.length,
    unusedReferences: unusedReferences.length,
    citationNeeded: citationNeeded.length,
    duplicateBibliography: duplicateBibliography.length,
    score
  };

  return {
    citationGroups,
    citedKeys,
    referenceKeys,
    missingReferences,
    unusedReferences,
    duplicateBibliography,
    citationNeeded,
    citedKeyCounts: citationMap,
    stats,
    markdown: buildMarkdownReport({
      stats,
      missingReferences,
      unusedReferences,
      duplicateBibliography,
      citationNeeded,
      citedKeys,
      referenceKeys
    })
  };
}

export function buildMarkdownReport(result) {
  const lines = [
    "# Citation Gap Audit",
    "",
    `Score: ${result.stats.score}/100`,
    "",
    "## Summary",
    "",
    `- Citation groups found: ${result.stats.citationGroups}`,
    `- Unique cited keys: ${result.stats.citedKeys}`,
    `- Reference keys found: ${result.stats.referenceKeys}`,
    `- Cited keys missing from references: ${result.stats.missingReferences}`,
    `- Reference keys not used in draft: ${result.stats.unusedReferences}`,
    `- Sentences that may need a source: ${result.stats.citationNeeded}`,
    "",
    "## Missing Reference Keys",
    ""
  ];

  pushList(lines, result.missingReferences, (key) => `- \`${key}\``);
  lines.push("", "## Unused Reference Keys", "");
  pushList(lines, result.unusedReferences, (key) => `- \`${key}\``);
  lines.push("", "## Sentences To Source-Check", "");
  pushList(lines, result.citationNeeded, (item) => `- Line ${item.line}: ${item.text}`);
  lines.push("", "## Duplicate Bibliography Keys", "");
  pushList(lines, result.duplicateBibliography, (item) => `- \`${item.key}\` appears ${item.count} times`);
  lines.push("", "## Boundary", "");
  lines.push("- This audit checks citation-key consistency and source-hunting cues only.");
  lines.push("- It does not verify that a citation is correct, relevant, or real.");

  return lines.join("\n");
}

function splitKeyList(value) {
  return dedupe(
    String(value || "")
      .split(/[;,]/)
      .map(cleanKey)
      .filter(Boolean)
  );
}

function cleanKey(value) {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .replace(/^[{\[(]+|[}\]),.;:]+$/g, "")
    .replace(/^[^A-Za-z0-9_.:-]+|[^A-Za-z0-9_.:-]+$/g, "");
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function findCitationNeededSentences(draft, citationGroups) {
  const candidates = splitSentences(draft);
  return candidates
    .filter((sentence) => shouldCheckSentence(sentence.text))
    .filter((sentence) => !SOURCE_TOKEN_RE.test(sentence.text))
    .filter((sentence) => !citationGroups.some((group) => overlaps(group, sentence)))
    .map((sentence) => ({
      text: sentence.text,
      line: lineNumberAt(draft, sentence.index),
      reason: reasonForSentence(sentence.text)
    }))
    .slice(0, 12);
}

function splitSentences(text) {
  const sentences = [];
  const source = String(text || "");
  const re = /[^.!?\n]+[.!?]?/g;
  let match;

  while ((match = re.exec(source))) {
    const raw = match[0].replace(/\s+/g, " ").trim();
    if (raw.length > 35 && !raw.startsWith("#")) {
      sentences.push({
        text: raw,
        index: match.index,
        end: match.index + match[0].length
      });
    }
  }

  return sentences;
}

function shouldCheckSentence(text) {
  if (text.length > 115) return true;
  return CLAIM_CUE_RE.test(text) || NUMERIC_CLAIM_RE.test(text);
}

function reasonForSentence(text) {
  if (NUMERIC_CLAIM_RE.test(text)) return "numeric claim";
  if (CLAIM_CUE_RE.test(text)) return "claim cue";
  return "long unsupported statement";
}

function overlaps(group, sentence) {
  return group.index < sentence.end && group.end > sentence.index;
}

function lineNumberAt(text, index) {
  return String(text || "")
    .slice(0, index)
    .split("\n").length;
}

function calculateScore({ citedCount, missingCount, unusedCount, neededCount, duplicateCount }) {
  if (citedCount === 0) return 35;
  const penalty = missingCount * 16 + unusedCount * 5 + neededCount * 7 + duplicateCount * 6;
  return Math.max(0, Math.min(100, 100 - penalty));
}

function pushList(lines, items, format) {
  if (!items.length) {
    lines.push("- None found.");
    return;
  }
  items.forEach((item) => lines.push(format(item)));
}

function dedupe(values) {
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const normalized = normalizeKey(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(cleanKey(value));
  });
  return out;
}
