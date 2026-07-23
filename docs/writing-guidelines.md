# Writing guidelines

> **Type**: Reference  
> **Status**: Current  
> **Audience**: Anyone who writes or reviews docs in this repo  
> **SoT**: This file is the house style for Markdown under `docs/` and the root `README.md`.

Editorial rules for Vela documentation. Synthesized from Apple Style Guide practices (terminology, clarity), the [Google developer documentation style guide](https://developers.google.com/style), and [Vercel writing guidelines](https://github.com/vercel-labs/writing-guidelines). These are **mandatory** for new and existing docs.

## Purpose

- Keep architecture, contracts, ADRs, and research scannable and consistent.
- Prefer binding truth in code and ADRs over prose-only rules.
- Make docs usable by humans and by coding agents without hallucinated APIs.

## Language

- Write all repository documentation in **US English**.
- Follow [Merriam-Webster](https://www.merriam-webster.com/) for spelling when unsure.
- For non-technical prose questions, prefer *The Chicago Manual of Style* conventions (same hierarchy Google uses).

## Content types

Declare a type near the top of every page (block quote or short metadata list). One page does one primary job.

| Type | Job | Typical paths |
|------|-----|----------------|
| **Landing** | Index, reading order, source of truth map | `docs/README.md` |
| **Conceptual** | What and why; teach the model | `architecture.md`, `composition-and-layers.md`, `materials.md`, … |
| **Reference** | Quotable facts, types, matrices | `api-contracts.md`, `platform-support.md`, `writing-guidelines.md` |
| **How-to** | Complete one task end to end | Future guides under `docs/how-to/` |
| **Decision** | Expensive-to-reverse choices | `docs/adr/*` |
| **Research** | External comparison; not product contract | `docs/research/*` |
| **Tracking** | Roadmap, gaps, acceptance | `roadmap.md`, `design-gaps.md`, `testing-and-acceptance.md` |

Rules:

- Research pages must not invent product API promises. Product behavior comes from `@vela/api` and Accepted ADRs.
- Tracking pages state status honestly. Do not pre-announce unshipped features as current behavior.
- If a page mixes types, split it or demote secondary material to Related links.

## Page skeleton

```markdown
# Sentence case title

> **Type**: Conceptual | Reference | …
> **Status**: Draft | Current | Superseded
> **Audience**: App authors | Host implementers | Maintainers
> **SoT**: packages/api/… or ADR NNNN when the page binds behavior

One-paragraph summary: what this page covers, who it is for, and when to leave.

## Section with a descriptive heading
…

## Related
- [Other page](other.md): why you would open it
```

### Required front matter fields

| Field | Meaning |
|-------|---------|
| Type | Content type from the table above |
| Status | Lifecycle of the *document* (not the feature) |
| Audience | Who should read this first |
| SoT | Optional. Path or ADR when rules are binding |

### Summary paragraph

Every page opens with one short summary after the metadata. A reader who landed from search must know whether to stay by the end of that paragraph.

Every major section should open with a summary sentence when the section is long.

## Voice and tone

Aligned with Google voice/tone and Vercel docs voice:

- Conversational and direct, not marketing and not academic.
- Second person: **you** when the reader acts. Prefer "the host" or "the Shell" for system roles when "you" is ambiguous.
- Active voice. Prefer "The Shell routes the hit" over "The hit is routed by the Shell".
- Present tense for current design and contracts. Use future tense only for explicit roadmap items.
- Imperative mood for steps: "Insert a material layer", not "You will need to insert".
- Limit **we**. Use it for deliberate project stance ("We recommend…", "We reject…"). Never use "we" as a stand-in for the reader.
- Contractions are fine (`you'll`, `it's`).

### Banned or discouraged wording

| Avoid | Prefer |
|-------|--------|
| easy, simple, quick, simply, just, really | Concrete facts: "one command", "default deny", "most apps use opaque" |
| should (ambiguous) | must / imperative if required; can if optional; "Prefer…" or "We recommend…" if advisory |
| please (in procedures) | Direct instruction |
| here / click here (as link text) | Descriptive link text |
| Pre-announcing unreleased behavior as fact | Status callout + roadmap link |
| **Bun-centered** (as product identity) | **TypeScript-first**, **WebView-first**, **desktop reference Host: Bun** ([ADR 0007](adr/0007-typescript-full-stack-host.md)) |
| Bun as the performance story | System WebView for App; T1.5 native for Host hot paths; Bun for DX / toolchain / desktop Host path |

Break any rule rather than write something unclear or wrong. Consistency still matters: if you depart, stay consistent within the page and note why when the departure is structural.

## Headings

- **Sentence case** for H1 through H6: "Composition and layers", not "Composition And Layers".
- Keep proper nouns and API identifiers in their canonical form: `@vela/api`, `HitPolicy`, WebView, Bun.
- Headings must be descriptive. Prefer "Why CSS-only glass fails" over "Background".
- Do not number headings in the title text unless the number is part of an ADR id (`ADR 0001`).

## Structure and lists

- Put conditions before instructions when both appear: "If the platform lacks Mica, request `win.acrylic`."
- Three or more parallel items in a paragraph: use a list.
- Numbered lists for sequences and lifecycles. Bullets for unordered sets. Tables for matrices, field maps, and comparisons.
- Introduce a list with a sentence or clause ending in a colon when it helps scanning.
- Bold term plus description is preferred for gloss-style bullets: `- **Layer**: composition unit in a window`.

## Terminology

Use one form everywhere. Expand acronyms on first use on a page when they are not product-core.

| Term | Canonical form |
|------|----------------|
| Product name | **Vela** |
| This monorepo checkout | `Vela` (product and clone name) |
| Legacy product | `Vela_old` (Rust/wgpu predecessor; no WebView core) |
| Contract package | `@vela/api` |
| Product framing | **TypeScript-first full stack**, **WebView-first** (not “Bun-centered”) |
| Privileged backend process (role) | Privileged Host or Host |
| Desktop Host implementation (reference) | Bun host / desktop reference Host (Bun) |
| Repo toolchain | Bun (install, test, typecheck, bundle) — implementation detail |
| Privileged native process | Native Shell or Shell |
| Untrusted UI JS | WebView page JS, App TS, or page JS |
| Host plugin language default | Host TS |
| Composition unit | Layer |
| In-window hit policy | `HitPolicy` |
| Window to OS input mode | `WindowInputMode` |
| System material id | `MaterialId` |
| Permission unit | Capability |

When you introduce a domain term, define it once and link to its conceptual page on first use.

## Cross-references and source of truth

Priority when rules conflict:

1. Accepted ADRs and types in `packages/api` (`@vela/api`)
2. Conceptual and reference docs that explain those contracts
3. Research notes (study only)
4. Tracking docs (plans and gaps)

Rules:

- Prefer binding rules in `@vela/api` over prose-only constraints.
- When a decision is expensive to reverse, add or update an ADR.
- Link research for vocabulary and comparison. Do not re-export foreign APIs as Vela's surface.
- If docs disagree with types, fix the docs or open a gap in `design-gaps.md`. Do not leave silent forks.

## Code and examples

- Fenced blocks always include a language tag (`ts`, `tsx`, `bash`, `text`, `json`).
- TypeScript first for Vela contracts and app examples.
- Mark contract-only examples when hosts do not exist yet: say "contract only" in prose near the snippet.
- Keep snippets focused. Prefer under ~25 lines; split with prose if longer.
- Explain what each non-trivial block does. Do not drop code without context.
- Placeholders: descriptive `snake_case` such as `your_access_token_here`. Avoid `<TOKEN>`, `xxx`, or `ABC123`.
- Inline code for identifiers, paths, flags, and short literals: `HitPolicy`, `packages/api/`, `kind: "material"`.
- Bold for UI labels when documenting UI (future how-tos). Do not bold for generic emphasis.

## Formatting and punctuation

- Use standard American punctuation and the serial comma.
- Do **not** use em dashes (`—`) or en dashes as clause punctuation. Use commas, colons, periods, or split the sentence.
- Prefer the ellipsis character (`…`) over three dots in UI copy. In technical prose, three dots in code remains fine.
- Dates: unambiguous forms (`2026-07-21` or `21 July 2026`). Avoid `07/21/26`.
- Source Markdown: **do not hard-wrap paragraphs**. One paragraph is one line in source. Let the editor wrap. Use a blank line between paragraphs and around code blocks.
- Prefer headings over horizontal rules (`---`) for structure. Front-matter style `---` fences are fine when you add YAML later.
- Tables are encouraged for comparisons, field lists, and status matrices.

## Accessibility and global audience

- Write short sentences. Target under 20 words when practical.
- Avoid idioms, slang, and culture-specific jokes.
- One word, one meaning on a page. Do not use the same term as both a casual verb and a type name without marking the type in code font.
- Descriptive link text that works out of context.
- If you add images later: alt text required; prefer vector or high-resolution assets.

## ADRs

Location: `docs/adr/`. Index: `docs/adr/README.md`.

Template:

```markdown
# ADR NNNN: Title in sentence case after the id

- **Status**: Proposed | Accepted | Superseded | Deprecated
- **Date**: YYYY-MM-DD
- **Deciders**: …

## Context
## Decisions
## Consequences
## References
```

Rules:

- One decision cluster per ADR.
- Prefer mapping decisions to `@vela/api` paths or host boundaries.
- Link follow-ups to `design-gaps.md` or issues instead of unbounded "Future work".
- When superseding, leave the old ADR in place and set Status to Superseded with a link to the replacement.

## Research pages

Location: `docs/research/`.

- State clearly that the page is study reference, not a runtime dependency.
- Map foreign concepts to Vela types. Do not re-export foreign APIs.
- Keep comparisons current enough to be useful; mark stale sections if a vendor changes direction.

## Tracking pages

- Use explicit status labels (`open`, `partial`, `closed`, phase names).
- Separate intentional product differentiators from unfinished work.
- Update dates or "last reviewed" when you make a pass on the whole file.

## AI-assisted writing

Docs train humans and models. Wrong docs are bugs.

- You are accountable for anything you merge, including model drafts.
- Plan the page (type, audience, goal, outline) before generating long prose.
- Verify every API name, field, and path against `@vela/api` or an ADR.
- Prefer enterprise or no-train modes when drafting unreleased material.
- Final human review is required for technical accuracy.

## Review checklist

Before you merge a doc change:

- [ ] Content type and status are declared
- [ ] Opening summary stands alone
- [ ] Sentence case headings
- [ ] No em dashes used as punctuation
- [ ] Paragraphs are not hard-wrapped
- [ ] No banned pressure words (`easy`, `simple`, `quick`, …)
- [ ] New terms defined or linked on first use
- [ ] Code fences have language tags
- [ ] Binding rules point at `@vela/api` or an ADR
- [ ] Research pages do not promise product APIs
- [ ] `docs/README.md` index updated if you added or moved a page
- [ ] Links updated after moves (especially `docs/research/`)

## Document map conventions

Keep the landing page (`docs/README.md`) partitioned by role:

1. Start here / reading order
2. Product conceptual and reference
3. Decisions (ADRs)
4. Research (external maps)
5. Tracking (roadmap, gaps, acceptance)
6. Writing guidelines (this file)

Root `README.md` stays a short product entry point. Deep indexes live under `docs/`.

## References (external)

| Source | Use |
|--------|-----|
| [Google developer documentation style guide](https://developers.google.com/style) | Voice, lists, person, global audience, highlights |
| [Google style highlights](https://developers.google.com/style/highlights) | Short checklist |
| [Vercel writing guidelines](https://github.com/vercel-labs/writing-guidelines) | Content types, banned words, source formatting, AI workflow |
| [Apple Style Guide](https://support.apple.com/guide/applestyleguide/welcome/web) | Terminology discipline, inclusive writing baseline |
| Swift API Design Guidelines | Clarity at point of use; documentation comments for APIs |

## Related

- [Documentation index](README.md)
- [ADR index](adr/README.md)
- [Design gaps](design-gaps.md)
