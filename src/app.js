import { SAMPLE_DRAFT, SAMPLE_REFERENCES, analyzeCitationGaps } from "./citeGap.js";

const draftInput = document.querySelector("#draft");
const refsInput = document.querySelector("#references");
const analyzeButton = document.querySelector("#analyze");
const sampleButton = document.querySelector("#sample");
const clearButton = document.querySelector("#clear");
const copyButton = document.querySelector("#copy");
const downloadButton = document.querySelector("#download");
const statusLine = document.querySelector("#status-line");
const scoreValue = document.querySelector("#score-value");
const scoreLabel = document.querySelector("#score-label");
const summaryGrid = document.querySelector("#summary-grid");
const missingList = document.querySelector("#missing-list");
const unusedList = document.querySelector("#unused-list");
const sourceList = document.querySelector("#source-list");
const duplicateList = document.querySelector("#duplicate-list");
const citationList = document.querySelector("#citation-list");
const markdownOutput = document.querySelector("#markdown-output");
const visualBars = document.querySelector("#visual-bars");

let currentResult = null;

function loadInitialState() {
  draftInput.value = localStorage.getItem("cite-gap-draft") || SAMPLE_DRAFT;
  refsInput.value = localStorage.getItem("cite-gap-references") || SAMPLE_REFERENCES;
  runAudit("Sample audit ready.");
}

function runAudit(message = "Audit updated.") {
  localStorage.setItem("cite-gap-draft", draftInput.value);
  localStorage.setItem("cite-gap-references", refsInput.value);
  currentResult = analyzeCitationGaps(draftInput.value, refsInput.value);
  render(currentResult);
  statusLine.textContent = message;
}

function render(result) {
  scoreValue.textContent = result.stats.score;
  scoreLabel.textContent = scoreTone(result.stats.score);
  summaryGrid.innerHTML = "";
  [
    ["Citation groups", result.stats.citationGroups],
    ["Cited keys", result.stats.citedKeys],
    ["Reference keys", result.stats.referenceKeys],
    ["Missing refs", result.stats.missingReferences],
    ["Unused refs", result.stats.unusedReferences],
    ["Source checks", result.stats.citationNeeded]
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "metric";
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    summaryGrid.appendChild(item);
  });

  renderKeyList(missingList, result.missingReferences, "No missing reference keys.");
  renderKeyList(unusedList, result.unusedReferences, "No unused reference keys.");
  renderSentenceList(sourceList, result.citationNeeded);
  renderDuplicateList(duplicateList, result.duplicateBibliography);
  renderCitationGroups(citationList, result.citationGroups);
  renderVisualBars(result.stats);
  markdownOutput.value = result.markdown;
}

function renderKeyList(container, keys, emptyText) {
  container.innerHTML = "";
  if (!keys.length) {
    container.appendChild(emptyItem(emptyText));
    return;
  }
  keys.forEach((key) => {
    const li = document.createElement("li");
    li.innerHTML = `<code>${escapeHtml(key)}</code>`;
    container.appendChild(li);
  });
}

function renderSentenceList(container, items) {
  container.innerHTML = "";
  if (!items.length) {
    container.appendChild(emptyItem("No source-check sentence cues found."));
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="line-pill">line ${item.line}</span><span>${escapeHtml(item.text)}</span><em>${escapeHtml(item.reason)}</em>`;
    container.appendChild(li);
  });
}

function renderDuplicateList(container, items) {
  container.innerHTML = "";
  if (!items.length) {
    container.appendChild(emptyItem("No duplicate bibliography keys."));
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<code>${escapeHtml(item.key)}</code> appears ${item.count} times`;
    container.appendChild(li);
  });
}

function renderCitationGroups(container, groups) {
  container.innerHTML = "";
  if (!groups.length) {
    container.appendChild(emptyItem("No citation keys detected yet."));
    return;
  }
  groups.slice(0, 18).forEach((group) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(group.style)}</span><code>${escapeHtml(group.keys.join(", "))}</code>`;
    container.appendChild(li);
  });
}

function renderVisualBars(stats) {
  visualBars.innerHTML = "";
  const max = Math.max(1, stats.citedKeys, stats.referenceKeys, stats.missingReferences, stats.unusedReferences);
  [
    ["Cited", stats.citedKeys, "ok"],
    ["References", stats.referenceKeys, "neutral"],
    ["Missing", stats.missingReferences, "warn"],
    ["Unused", stats.unusedReferences, "soft"]
  ].forEach(([label, value, tone]) => {
    const row = document.createElement("div");
    row.className = `bar-row ${tone}`;
    row.innerHTML = `<span>${label}</span><div class="bar-track"><i style="width:${Math.max(6, (value / max) * 100)}%"></i></div><strong>${value}</strong>`;
    visualBars.appendChild(row);
  });
}

function emptyItem(text) {
  const li = document.createElement("li");
  li.className = "empty";
  li.textContent = text;
  return li;
}

function scoreTone(score) {
  if (score >= 90) return "clean";
  if (score >= 70) return "review";
  if (score >= 45) return "needs work";
  return "triage";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function copyReport() {
  if (!currentResult) runAudit();
  const text = currentResult.markdown;
  try {
    await navigator.clipboard.writeText(text);
    statusLine.textContent = "Markdown report copied.";
  } catch {
    markdownOutput.focus();
    markdownOutput.select();
    document.execCommand("copy");
    statusLine.textContent = "Markdown report selected for copying.";
  }
}

function downloadReport() {
  if (!currentResult) runAudit();
  const blob = new Blob([currentResult.markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "citation-gap-audit.md";
  link.click();
  URL.revokeObjectURL(url);
  statusLine.textContent = "Markdown report downloaded.";
}

analyzeButton.addEventListener("click", () => runAudit());
sampleButton.addEventListener("click", () => {
  draftInput.value = SAMPLE_DRAFT;
  refsInput.value = SAMPLE_REFERENCES;
  runAudit("Synthetic sample loaded.");
});
clearButton.addEventListener("click", () => {
  draftInput.value = "";
  refsInput.value = "";
  runAudit("Inputs cleared.");
});
copyButton.addEventListener("click", copyReport);
downloadButton.addEventListener("click", downloadReport);

loadInitialState();
