import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { analyzeCitationGaps, SAMPLE_DRAFT, SAMPLE_REFERENCES } from "../src/citeGap.js";

const root = process.cwd();
const requiredFiles = [
  "index.html",
  "styles.css",
  "src/app.js",
  "src/citeGap.js",
  "README.md",
  "LICENSE",
  "package.json"
];

requiredFiles.forEach((file) => assert.ok(existsSync(join(root, file)), `${file} must exist`));

const html = readFileSync(join(root, "index.html"), "utf8");
const scriptMatches = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g), (match) => match[1]);
const cssMatches = Array.from(html.matchAll(/<link[^>]+href="([^"]+)"/g), (match) => match[1]);

[...scriptMatches, ...cssMatches].forEach((asset) => {
  assert.ok(existsSync(join(root, asset)), `Referenced asset is missing: ${asset}`);
});

const result = analyzeCitationGaps(SAMPLE_DRAFT, SAMPLE_REFERENCES);
assert.equal(result.stats.missingReferences, 1, "sample should expose one missing reference");
assert.equal(result.stats.unusedReferences, 1, "sample should expose one unused reference");
assert.ok(result.markdown.includes("Boundary"), "report should include limitations");

const forbiddenPatterns = [
  /gho_[A-Za-z0-9_]+/,
  /github_pat_[A-Za-z0-9_]+/,
  /\/Users\/batuer\//
];

assert.ok(!existsSync(join(root, "node_modules")), "node_modules must not be present");

for (const file of walk(root)) {
  const rel = relative(root, file);
  if (rel.startsWith(".git/")) continue;
  if (/\.(png|jpg|jpeg|gif|webp|ico)$/i.test(rel)) continue;
  const body = readFileSync(file, "utf8");
  forbiddenPatterns.forEach((pattern) => {
    assert.ok(!pattern.test(body), `${rel} contains forbidden pattern ${pattern}`);
  });
}

console.log("check passed: files, sample audit, asset links, and secret scan are clean");

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  entries.forEach((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if ([".git", "node_modules"].includes(entry)) return;
      files.push(...walk(path));
      return;
    }
    files.push(path);
  });
  return files;
}
