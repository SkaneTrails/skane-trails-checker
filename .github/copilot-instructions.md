# Skåne Trails Checker - AI Coding Agent Instructions

## ⚠️ FIRST: Read Working Context

**At conversation start, ALWAYS:**

1. Read `.copilot-tasks.md` using `read_file`
1. Check for active tasks on current branch
1. Skim Failure Tracking table for patterns relevant to current topic
1. Acknowledge what you found before proceeding

This file is gitignored (local-only, never committed). Ignoring it loses track of work.

**On failure:** Log to Failure Tracking table in `.copilot-tasks.md`; when count reaches 3, promote to permanent documentation.

### ⚠️ Two Todo Systems — Do NOT Confuse Them

|                    | `.copilot-tasks.md`                               | `manage_todo_list` tool                            |
| ------------------ | ------------------------------------------------- | -------------------------------------------------- |
| **Purpose**        | Persistent project backlog across conversations   | Ephemeral progress tracker within a single session |
| **Lifetime**       | Permanent — local file (gitignored)               | Gone when conversation ends                        |
| **Content**        | Open issues, deferred work, failure tracking      | Steps for the current task only                    |
| **When to update** | Branch changes, tasks complete, issues discovered | Breaking down multi-step work in progress          |

**Never** use `manage_todo_list` as a substitute for updating `.copilot-tasks.md`. They serve completely different purposes.

______________________________________________________________________

## Collaboration Guidelines

You are collaborating with a human who may make changes between your edits:

- **Always re-verify** file contents before making changes - don't assume previous state
- **If your previous changes are gone**, do not re-add them without checking with the user first
- **Read before editing** - the human may have modified, moved, or intentionally removed content
- **Verify suggestions** - when given review comments, verify against actual code before applying. If incorrect, point it out
- **Compare alternatives** - when the user suggests a different approach, analyze both and explain tradeoffs
- **Troubleshoot step-by-step** - suggest one fix at a time and wait for results
- **Exploratory questions → answer only** - when asked "how", "why", or "what would change", answer only. NEVER start implementing
- **Assess test coverage for bugs** - see `python-style-guide.instructions.md` Testing section
- **Track iterations** - when a command fails, IMMEDIATELY log to Failure Tracking in `.copilot-tasks.md` BEFORE retrying
- **Plan before non-trivial changes** - present a plan and save to `.copilot-tasks.md`. Non-trivial = affects multiple consumers, alters interfaces, introduces patterns, or has side effects
- **State side effects** - if Feature A changes Feature B's behavior, state that explicitly
- **Communicate scope decisions** - if splitting work, state the plan upfront. Never silently defer work
- **Prefer standard git tools** - use `git` and `gh` CLI. NEVER use GitKraken MCP tools
- **Solve the actual problem** - don't suggest workarounds that avoid the problem instead of solving it
- **Consider alternatives early** - if an approach seems impossible, offer to explore alternatives before investing heavily
- **Never work directly on main** - create feature branches with conventional prefixes (`feat/`, `fix/`, `chore/`)
- **Avoid parallel branches on same files** - check for open PRs first. See `pr-review-workflow` skill
- **Before editing Copilot config** - read `copilot-self-improvement` skill
- **After pulling from main** - check `git diff HEAD@{1} --name-only` for config/skills/instructions changes. Re-read if changed
- **Never use `--no-verify`** - if hooks fail, fix the underlying issue
- **Never use `git commit --amend` after hook failure** - the original commit was never created. Do `git add -A && git commit -m "style: apply auto-fixes"` instead
- **Before committing** - grep staged files for API keys (`AIzaSy`, `sk-`, `ghp_`), emails, project IDs. If found, read `security` skill
- **Update `.copilot-tasks.md` as you work** - mark tasks complete immediately
- **Never run inline Python in PowerShell** - write to a temp `.py` file (in `tmp/`) and execute it
- **Never fabricate project IDs or secrets** - read from `.env` or ask the user
- **Use existing scripts first** - check `dev-tools/` before writing ad-hoc commands
- **PowerShell backtick escaping** - NEVER include backticks in `gh` CLI string arguments. Write to temp file and use `-F "body=@file.md"`
- **PowerShell pipeline commands hang** - use Copilot tools (`grep_search`, `file_search`, etc.) instead of PowerShell pipelines
- **Zero tolerance for errors** - every error is your responsibility regardless of when introduced. Do not commit until clean

______________________________________________________________________

## Project Overview

A FastAPI + Expo/React Native app for tracking hiking trails and foraging spots in Skåne, Sweden. Processes GPX files, manages trail statuses, provides interactive maps.

**ZERO-COST REQUIREMENT**: GitHub Free + GCP Free Tier only. ALL suggestions must stay within these constraints.

## Free Tier Constraints

**GCP monthly limits (NON-NEGOTIABLE):**

- **Cloud Run**: 2M requests, 360K GB-sec, 180K vCPU-sec
- **Firestore**: 1 GB storage, 50K reads/day, 20K writes/day
- **Cloud Storage**: 5 GB, 5K Class A / 50K Class B operations
- **Cloud Build**: 120 build-min/day
- **Secret Manager**: 6 active versions

If any suggestion exceeds limits, STOP and ask first.

**GitHub Free (public repo):** No branch protection, no Advanced Security. SARIF uploads need `continue-on-error: true`. Rely on Trivy scans.

**All infrastructure in Terraform** — see `terraform.instructions.md`. Never manual creation via console/CLI. All secrets via GCP Secret Manager — never hardcode. Public repo: `.tfvars`, `.env*`, credentials are gitignored; use `.example` templates.

______________________________________________________________________

## Architecture

**FastAPI API** (backend):

- `api/models/` — Pydantic models (Trail, Place, Foraging)
- `api/routers/` — REST endpoints (trails, foraging, places)
- `api/auth/` — Firebase Auth middleware (token validation, `require_auth` dependency)
- `api/storage/` — Firestore persistence + client

**Expo/React Native** (frontend, `mobile/`):

- Follows meal-planner architecture: Expo Router, React Query, NativeWind
- Theme engine: `lib/theme/` with token-based `ThemeProvider` + `useTheme()` hook
- Shared components: `components/` — Button, Toggle, Chip, etc. (all theme-driven)
- Map: react-leaflet (web-first) with trail polylines + markers

**GPX processing** (server-side):

- `app/functions/gpx.py` + `trail_converter.py` — parse, simplify, save
- `app/functions/bootstrap_trails.py` — seed planned hikes from bundled GPX

**State**: Firestore for persistence, React Query for client cache. See `firestore.instructions.md` for schema.

**5 Firestore collections**: `trails`, `trail_details`, `foraging_spots`, `foraging_types`, `places`

______________________________________________________________________

## Key Patterns

### GPX Handling

- Parser: `gpxpy` for GPX XML, `rdp` for coordinate simplification (tolerance: 0.0001)
- Upload: temp file → parse validation → Firestore storage
- Tracks have multiple segments; always iterate all. Check `len(coordinates) > 0`
- Always open with `encoding="utf-8"` for special characters

### Map Rendering

- react-leaflet with OpenStreetMap tiles (zero cost, no API key)
- Status colors: "Explored!" = blue (#4169E1), "To Explore" / Skåneleden = orange (#FF8000)
- Trail polylines from `coordinates_map` array; full detail from `trail_details`

### Trail Sources

Three sources filter trails from Firestore: `planned_hikes` (Skåneleden), `other_trails` (local), `world_wide_hikes` (international).

______________________________________________________________________

## Documentation & Quality

**Update docs BEFORE pushing** when changes affect setup, infra, scripts, or workflows. Check READMEs, `.example` files, and this file's Architecture section.

**Testing:** TDD preferred. Bug fixes require a regression test first. See `python-style-guide.instructions.md` for test patterns, coverage, and `# pragma: no cover` rules.

**Coverage:** Enforced by `fail_under` in `pyproject.toml`. Every file in `app/` and `api/` must maintain high coverage. Run: `uv run pytest --cov=app --cov=api --cov-report=term-missing`

**Warnings:** Never suppress — fix the root cause. Pytest uses `-W error`.

### Pre-Commit Checklist

- [ ] Zero compile/type errors across the codebase
- [ ] Storage mapping functions (`_doc_to_*`) include new fields, with test assertions
- [ ] Coverage passes (threshold in `pyproject.toml`)
- [ ] No single file dropped below threshold

______________________________________________________________________

## Skills

| Skill                       | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `copilot-self-improvement/` | Meta-skill for maintaining Copilot config, skills, instructions |
| `local-development/`        | GCP secrets, .env setup, starting servers, troubleshooting      |
| `pr-review-workflow/`       | PR creation, review comments, CI status using GitHub CLI        |
| `security/`                 | Security best practices and preventing sensitive data leaks     |
| `working-context/`          | Track tasks and discovered issues across conversations          |
