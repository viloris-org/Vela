# Agent skills (build apps with Vela)

> **Audience**: Coding agents and developers **building applications on Vela**  
> **Not for**: Maintaining this monorepo (hosts, `@vela/*` packages, ADRs)

Installable task guides for scaffolding and authoring Vela App packages. They
assume the working directory is a **user app** (or a place you are about to
create one), not the Vela framework tree, unless a skill step explicitly says
to copy from a Vela checkout.

| Skill | Path | Job |
|-------|------|-----|
| [create-vela-app](create-vela-app/SKILL.md) | `skills/create-vela-app` | Scaffold a new App package from `templates/minimal` |
| [vela-app-ts](vela-app-ts/SKILL.md) | `skills/vela-app-ts` | Author App TypeScript against `window.vela` |

## Source of truth (do not fork)

Skills are workflows. Binding types and layout rules live elsewhere:

1. `@vela/api` (`packages/api/`) — bridge, layers, hit, capabilities, package parse
2. [App package layout](../docs/app-package-layout.md) — `vela.json` tree
3. Accepted ADRs under `docs/adr/`
4. [templates/](../templates/) — file trees to copy

If a skill disagrees with those, fix the skill.

## Install

Use the open [skills](https://github.com/vercel-labs/skills) CLI (`npx skills`).
It discovers every `skills/*/SKILL.md` in this repository.

**Prerequisite for scaffold workflows:** a Vela checkout (or a copy of
`templates/minimal`). Skills teach the agent *how*; templates and `@vela/api`
still come from the framework tree or a published package.

### List what this repo provides

```bash
# from a local clone
npx skills add -l /path/to/Vela

# from GitHub (after skills are on the default branch)
npx skills add -l viloris-org/Vela
```

### Recommended: global install (any project)

Install both skills into your user-level agent skill dirs so any coding agent
can scaffold or author Vela apps:

```bash
# local clone (works before push)
npx skills add -g -y /path/to/Vela

# GitHub
npx skills add -g -y viloris-org/Vela
```

Install only one skill:

```bash
npx skills add -g -y viloris-org/Vela --skill create-vela-app
npx skills add -g -y viloris-org/Vela --skill vela-app-ts
```

Target a specific agent (examples: `grok`, `claude-code`, `cursor`, `codex`):

```bash
npx skills add -g -y viloris-org/Vela -a grok
npx skills add -g -y viloris-org/Vela -a claude-code -a cursor
```

Use `--all` to install every skill from this repo to every detected agent:

```bash
npx skills add --all viloris-org/Vela
# equivalent: --skill '*' --agent '*' -y
```

### Project install (commit with an app repo)

From the **user product** repository (not required inside the Vela monorepo):

```bash
cd /path/to/MyApp
npx skills add -y viloris-org/Vela
# or: npx skills add -y /path/to/Vela
```

Default scope is **project** (writes under that repo’s agent skill folders, e.g.
`.agents/skills/`, `.claude/skills/`, `.grok/skills/`). Commit those paths if
the team should share the same agent workflows.

### Local path (dogfood this checkout)

```bash
cd /path/to/Vela
npx skills add -g -y .
# or absolute
npx skills add -g -y /home/you/Project/Vela
```

### Scope and layout

| Scope | Flag | Typical location | Use |
|-------|------|------------------|-----|
| **Project** | (default) | `./.agents/skills/`, `./.claude/skills/`, … | Share with the app team |
| **Global** | `-g` | `~/.agents/skills/`, `~/.claude/skills/`, `~/.grok/skills/`, … | Use Vela from any directory |

Symlink install is the CLI default (one canonical copy, easy `npx skills update`).
Pass `--copy` if your environment cannot use symlinks.

### Verify

```bash
npx skills list
# or global only
npx skills list -g
```

You should see `create-vela-app` and `vela-app-ts`.

### Update / remove

```bash
npx skills update -g          # refresh global installs from source
npx skills update -p          # project installs
npx skills remove create-vela-app vela-app-ts
npx skills remove -g create-vela-app
```

### Use once without installing

```bash
npx skills use viloris-org/Vela@create-vela-app
# local:
npx skills use /path/to/Vela@create-vela-app
```

### One-shot install recipes

```bash
# Global, both skills, skip prompts (recommended for app authors)
npx skills add -g -y viloris-org/Vela

# Global from this machine’s clone
npx skills add -g -y "$(git -C /path/to/Vela rev-parse --show-toplevel 2>/dev/null || echo /path/to/Vela)"

# Project-local inside MyApp
cd MyApp && npx skills add -y viloris-org/Vela --skill create-vela-app --skill vela-app-ts
```

### After install: still need the framework tree

| Need | Where it comes from |
|------|---------------------|
| Skill steps (this folder) | `npx skills add` → agent skill dir |
| `templates/minimal` copy source | Vela git clone (or future packaged scaffold) |
| `@vela/api` types | `workspace:*` in monorepo, or `file:` / registry dep in the app |
| Deep docs | Vela `docs/` or https://github.com/viloris-org/Vela/tree/main/docs |

`create-vela-app` tells the agent to `cp -R` from a Vela checkout. Point the
agent at that checkout path when scaffolding.

### Manual install (no CLI)

```bash
# example: Grok Build global skills
mkdir -p ~/.grok/skills
cp -R /path/to/Vela/skills/create-vela-app ~/.grok/skills/
cp -R /path/to/Vela/skills/vela-app-ts ~/.grok/skills/
```

Adjust the target (`~/.claude/skills`, `~/.agents/skills`, project
`.agents/skills`, …) for your agent. See the [skills CLI agent table](https://github.com/vercel-labs/skills#supported-agents).

Do **not** treat `templates/` as runnable demos. Copy, then rename (see each
skill and [templates/README.md](../templates/README.md)).

## Adding a skill

1. Create `skills/<kebab-name>/SKILL.md` with YAML front matter (`name`,
   `description` including "Use when …").
2. Write for **app authors**: steps, renames, deny-by-default capabilities,
   verification commands. Link docs; do not paste full API surfaces.
3. Prefer monorepo-root paths or `https://github.com/viloris-org/Vela/...` links
   so installs outside this repo still resolve.
4. State honestly when a host feature is mock-only or unshipped.
5. Add a row to the table above.
6. Check discovery: `npx skills add -l .` from the Vela root.
7. Keep maintainer-only workflows out of this tree.

## Related

- [Templates catalog](../templates/README.md)
- [App package layout](../docs/app-package-layout.md)
- [API contracts](../docs/api-contracts.md)
- [Capabilities and plugins](../docs/capabilities-and-plugins.md)
- [skills CLI](https://github.com/vercel-labs/skills) · [skills.sh](https://skills.sh/)
