# Cite Gap Audit

Local-first citation gap auditor for academic drafts, BibTeX snippets, and Markdown reference lists.

Paste a draft and a list of reference keys. Cite Gap Audit finds citation keys that are used but missing from the reference list, reference keys that never appear in the draft, duplicate bibliography keys, and claim-like sentences that may need a source check. It then creates a Markdown audit report you can copy into a paper-review checklist, lab meeting note, or thesis TODO file.

## Why this exists

Academic drafts often fail in small, boring places: a `\cite{...}` key goes stale, a reference dump contains unused entries, or a strong claim survives without a source marker. A tiny local checker is useful because it can run before heavier writing tools, without uploading drafts, installing a citation manager, or asking an AI system to infer sources.

This project aims to be worth starring because it is:

- Small enough to understand in one sitting.
- Useful in real paper-reading and course-writing workflows.
- Local-first and dependency-free.
- Honest about its boundary: it audits keys and cues, not source truth.
- Easy to fork for a lab, class, or Markdown writing style.

## Learning and research scenarios

- Literature review drafts where citation keys drift while notes are reorganized.
- Course essays or lab reports that mix Markdown notes and BibTeX.
- Paper-reading groups that want a quick source hygiene pass before discussion.
- Thesis chapters where unused references and source-needed claims should be triaged separately.

## What it can do

- Parse LaTeX-style citation commands such as `\cite{smith2024}` and `\citep{smith2024,lee2025}`.
- Parse Pandoc-style citations such as `[@smith2024; @lee2025]`.
- Parse reference keys from BibTeX, Markdown lists such as `- [smith2024] ...`, and `id: smith2024` lines.
- Report missing reference keys, unused reference keys, duplicate bibliography keys, and source-check sentence cues.
- Show a compact key-balance visual.
- Copy or download a Markdown report.
- Run entirely in the browser with no login, network call, or API key.

## Demo input

The app opens with synthetic sample text. The sample intentionally includes one missing citation key and one unused reference key so the audit result is visible immediately.

Draft excerpt:

```text
Prior work in reproducible notebook practice often asks authors to keep code, data, and claims connected \cite{rule2024}.

Markdown writers can also use Pandoc-style keys such as [@smith2023; @lee2025] when drafting literature notes. A draft may accidentally cite \citep{missing2026}.
```

Reference excerpt:

```text
@article{rule2024,
  title = {Synthetic notebook practice placeholder}
}

- [smith2023] Smith, R. Synthetic source note.
- [lee2025] Lee, M. Synthetic source note.
- [unused2022] Unused sample reference kept here on purpose.
```

## How to run

Open `index.html` directly, or serve the folder locally:

```bash
python3 -m http.server 5201 --bind localhost
```

Then open:

```text
http://localhost:5201/index.html
```

For checks:

```bash
npm test
npm run check
npm run verify:browser
```

`verify:browser` is optional and expects a local Chrome-compatible browser. It opens the local app through Chrome DevTools, checks a desktop interaction path, and checks a 390px mobile viewport for horizontal overflow.

## Boundary

Cite Gap Audit does not verify that a source exists, supports the claim, is peer-reviewed, or is correctly formatted. It does not replace a citation manager, style guide, paper, textbook, or instructor feedback. Treat every flagged sentence as a review prompt, not a factual judgment.

All default sample content is synthetic and exists only to demonstrate the workflow. No real study result is implied by the sample.

## Inspiration

Public research-tool lists and local-first writing discussions show ongoing demand for lightweight paper-reading, reference, and note hygiene tools. I used those sources only for the idea shape, then wrote original code, UI, sample text, and documentation.

- Awesome AI Research Tools: https://github.com/0x11c11e/awesome-ai-research-tools
- Local-first academic note-taking discussion around Outl: https://www.outl.app/

## Possible extensions

- Add CSL JSON and RIS parsers.
- Add optional ignore comments such as `<!-- cite-gap-ignore -->`.
- Export CSV rows for missing, unused, and source-check findings.
- Add a lab-specific citation key naming rule checker.
