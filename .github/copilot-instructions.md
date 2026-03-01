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

## Important: Collaboration Guidelines

You are collaborating with a human who may make changes between your edits:

- **Always re-verify** file contents before making changes - don't assume previous state
- **If your previous changes are gone**, do not re-add them without checking with the user first
- **Read before editing** - the human may have modified, moved, or intentionally removed content
- **Verify suggestions** - when given review comments or suggestions, verify they are correct against actual code before applying. If a suggestion is incorrect, point that out rather than blindly applying it
- **Compare alternatives** - when the user suggests a different approach, analyze both options and explain the tradeoffs before implementing. Don't assume the user's suggestion is better - justify the choice
- **Troubleshoot step-by-step** - when debugging or troubleshooting, suggest one fix at a time and wait for the result before suggesting the next step. Don't overwhelm with multiple suggestions at once
- **Exploratory questions → answer only** - when asked "how", "why", or "what would the changes be", answer the question only. NEVER start implementing. Wait for explicit instruction to proceed
- **Assess test coverage for bugs** - when a bug is reported, assess whether a test should be added to catch it. Explain why existing tests missed it (e.g., mocking strategy, missing coverage) and propose a targeted test if appropriate
- **Track iterations** - when a command/approach fails, IMMEDIATELY log to Failure Tracking table in `.copilot-tasks.md` BEFORE retrying with a different approach
- **Plan before non-trivial changes** - before implementing any non-trivial change, present a plan and save it to `.copilot-tasks.md`. If information is missing, ask — don't assume. Trivial changes (e.g., renaming a label, fixing a typo) can proceed directly. A change is non-trivial when it affects multiple consumers, alters component interfaces, introduces new patterns, or has side effects beyond the immediate target
- **State side effects and consequences** - the plan must include any side effects or consequences that aren't obvious. If adding Feature A changes Feature B's behavior or removes Feature C, state that explicitly. Examples: adding a prop to a shared component affects all consumers; changing a model field requires storage layer and API updates
- **Communicate scope decisions** - if splitting work (e.g., backend-first, then mobile), state the plan upfront and ask if the approach works before starting. Never silently defer work and present it as complete
- **Prefer standard git tools** - use `git` commands and `gh` CLI over GitKraken MCP tools. GitKraken tools should only be used when explicitly requested or when they provide functionality not available through standard tools
- **Solve the actual problem** - when hitting obstacles (permissions, cross-repo dependencies, missing APIs), do not suggest workarounds that avoid the problem instead of solving it. If the goal is "validate X" and validation requires extra permissions, the answer is "add the permissions" not "skip validation." Never present a workaround as equivalent to a real solution.
- **Consider alternatives early** - if fixing an issue seems difficult, time-consuming, or impossible due to fundamental limitations (library constraints, architectural issues, external dependencies), proactively offer to explore alternative approaches or tools. Don't spend excessive time patching around a root cause that can't be solved. Ask: "Should we look for alternatives?" before investing heavily in workarounds.
- **Never work directly on main** - Always create a feature branch for changes. Use conventional commit prefixes (feat:, fix:, chore:, etc.) in branch names (e.g., `feat/add-feature`, `fix/bug-name`, `chore/update-deps`)
- **Avoid parallel branches that touch the same files** - Before creating a new branch, check for open PRs (`gh pr list`). If an open PR modifies the same high-churn files, either stack the new branch on top of that PR's branch or wait for it to merge. See `pr-review-workflow` skill for details
- **Before editing Copilot config** - read `copilot-self-improvement` skill before modifying `copilot-instructions.md`, `*.instructions.md`, skills, or `copilot-references.md`
- **After pulling from main** - check `git diff HEAD@{1} --name-only` for changes to `.github/copilot-instructions.md`, `.github/skills/**`, `*.instructions.md`, or `.copilot-tasks.md`. If any changed, re-read them before continuing work — they may contain updated instructions, new skills, or task state changes from another session
- **Never use `--no-verify`** - NEVER pass `--no-verify` or `-n` to `git commit` or `git push`. Pre-commit hooks exist for a reason — bypassing them lets broken code, lint violations, and security issues slip through. If hooks fail, fix the underlying issue
- **Never use `git commit --amend` after hook failure** - When a pre-commit hook fails and auto-fixes files (e.g., Ruff), the original `git commit` never creates a commit. Running `--amend` then modifies the *previous* commit (often a merge commit), corrupting history. Instead: `git add -A && git commit -m "style: apply auto-fixes"` as a separate commit. To avoid the issue entirely, run formatters before committing: `uv run ruff format .`
- **Before committing** - quick security scan: grep staged files for API keys (`AIzaSy`, `sk-`, `ghp_`), emails (`@gmail.com`, `@outlook.com`), project IDs. If found, read `security` skill before proceeding
- **Update `.copilot-tasks.md` as you work** - mark tasks complete immediately, don't batch updates
- **Never run inline Python in PowerShell** - NEVER use `python -c "..."` or `uv run python -c "..."` in the terminal. PowerShell mangles parentheses, quotes, and special characters inside string arguments, causing `SyntaxError: '(' was never closed` and similar parse errors. **Always** write the code to a temporary `.py` file (in `tmp/`) and execute it with `python tmp/script.py`. Delete the file afterward if it was single-use.
- **Never fabricate project IDs or secrets** - NEVER guess or invent GCP project IDs, API keys, or other environment values. Always read from `.env` (`GOOGLE_CLOUD_PROJECT`) or ask the user. Fabricated IDs waste time and erode trust
- **Use existing scripts first** - before writing inline Python or ad-hoc commands, check `dev-tools/` and skill documentation for existing tools that do what you need
- **PowerShell backtick escaping** - NEVER include backtick characters in ANY `gh` CLI string argument — not just `--body`, but also `-f "body=..."`, `-f "query=..."`, commit messages, or any inline string. PowerShell interprets `` ` `` as escape characters, causing `Unicode escape sequence is not valid` errors. **Workarounds:** (1) Write content to a temp file, use `-F "body=@file.md"` or `--body-file`, then delete the file. (2) For short replies without markdown formatting, just omit backticks entirely
- **PowerShell pipeline commands hang** - NEVER use `Get-ChildItem | ForEach-Object`, `Select-String` pipelines, or nested PowerShell commands for workspace scanning — they hang indefinitely on Windows. Use `grep_search`, `file_search`, `list_dir`, or `semantic_search` tools instead
- **Zero tolerance for errors** - There is no such thing as a "pre-existing" error. If you encounter a compile error, type error, lint violation, or any other issue — fix it immediately, regardless of when it was introduced. A merge to main must never contain known bugs. Never dismiss an error as "not related to my changes" or "pre-existing." If you see it, you own it. **After `get_errors`:** never triage results into "my errors" vs "other errors" — every error in the output is your responsibility. Do not proceed to commit until the list is clean (excluding errors in `node_modules/` or other vendored/external code).

## Documentation Standards

**All documentation targets a junior developer** unfamiliar with Terraform, GCP, and related tools. Assume they can clone a repo, run a script, and follow step-by-step instructions.

### Keeping Documentation Current

> **BLOCKING REQUIREMENT: Update docs BEFORE pushing.**

When making changes that affect setup, infrastructure, scripts, or workflows:

- [ ] **Infrastructure changes** → Update `infra/environments/dev/README.md`
- [ ] **New/changed scripts** → Update script headers + README
- [ ] **New variables** → Update `terraform.tfvars.example` + variables table in README
- [ ] **New modules** → Update "Modules Used" in environment README
- [ ] **Architecture changes** → Update `copilot-instructions.md` Architecture section
- [ ] **New skills** → Add to skills table in `copilot-instructions.md`

### Automation over Manual Steps

- **Never require manual file creation** for setup. Use scripts or `.example` template files that the user copies
- **Consolidate scripts** — prefer one script with subcommands or flags over many single-purpose scripts
- **Scripts must be idempotent** — safe to run multiple times, skip already-completed steps
- **Error messages must guide the user** — on failure, explain what went wrong AND what to do next
- **Provide both `.sh` and `.ps1`** for cross-platform support

### Script Design Principles

- Check prerequisites at the start (authenticated? CLI installed? files exist?)
- Use colored output to distinguish success (green), warnings (yellow), errors (red)
- Show progress: what step is running, what was created/skipped
- Never silently succeed or fail — always confirm the outcome

## Documentation Research Guidelines

**When encountering unexpected behavior, limitations, or obstacles, PROACTIVELY offer to check official documentation BEFORE attempting workarounds.**

### When to Check Documentation

Offer to research documentation when you encounter:

- **Library/Framework limitations** - API doesn't behave as expected, missing features, or constraints
- **Integration issues** - Components not working together as anticipated
- **Unexpected behavior** - Code produces results that contradict assumptions
- **Missing functionality** - Feature seems impossible with current approach
- **Multiple failed attempts** - Same problem resists 2+ solution attempts

### Documentation Research Process

1. **Identify the knowledge gap** - What specific behavior/feature is unclear?
1. **Propose documentation sources** - Suggest which docs to check (official docs, GitHub repos, API references)
1. **Get approval** - Ask: "Should I check the official documentation for [X] before proceeding?"
1. **Research thoroughly** - Use `fetch_webpage` for official docs, `github_repo` for implementation examples
1. **Report findings** - Summarize what the docs say and how it changes the approach
1. **Update solution** - Implement based on authoritative information, not guesswork

### Example Scenarios

**❌ BAD - Guessing without checking:**

```
The API doesn't seem to support this. Let me try a workaround with [complex hack].
```

**✅ GOOD - Proactive documentation check:**

```
The API isn't behaving as expected. Before trying workarounds, should I check
the official [library] documentation to see if there's a proper way to handle this?
```

### Documentation Sources Priority

1. **Official project documentation** - Primary source of truth
1. **GitHub repository examples** - Real-world usage patterns
1. **API reference docs** - Detailed parameter/return value specs
1. **GitHub issues/discussions** - Known limitations and workarounds
1. **Stack Overflow** - Community solutions (verify against official docs)

**Never assume library behavior without checking documentation when hitting obstacles.**

## Pull Request Reviews

**When performing Copilot-assisted PR reviews**, check if changes affect this documentation and suggest updates as part of your review:

- New/renamed/removed workflows in `.github/workflows/`
- Changes to code style tools (ruff, pre-commit hooks, etc.)
- New dependencies or architectural patterns
- Changes to testing patterns or conventions
- Updates to development workflows or commands

If changes impact how code should be written, reviewed, or debugged, suggest updating `.github/copilot-instructions.md`.

**Important:** This file is strictly for Copilot coding assistance. All changes must be relevant to AI-assisted coding (writing, reviewing, debugging, troubleshooting). Do not add operational, access, or administrative information that doesn't affect code or troubleshooting.

## Project Overview

A Streamlit multi-page application for tracking hiking trails and foraging spots in Skåne, Sweden. The app processes GPX files, manages trail completion statuses, and provides interactive maps for both hiking trails and seasonal foraging locations.

**ZERO-COST REQUIREMENT**: This project operates entirely on free tiers - GitHub Free + GCP Free Tier. ALL suggestions must work within these constraints.

## Critical Constraints: Free Tier Only

**This project is designed to run at zero cost using free tiers only. This is a hard requirement, not a preference.**

### GitHub Free Tier (Public Repository)

**All GitHub features must work on the free tier:**

- **No branch protection rules** - Cannot enforce required reviews, status checks, or restrict who can push
- **No GitHub Advanced Security** - Code scanning SARIF uploads may fail, dependency review not available
- **Public repository** - All code, issues, and PRs are publicly visible
- **Actions minutes** - Unlimited for public repos, 2,000 minutes/month for private repos
- **Artifacts storage** - 500 MB storage, 1 GB bandwidth/month

**Implications for workflows:**

- SARIF uploads should use `continue-on-error: true` (may not have code scanning enabled)
- Dependency review action not supported (requires Advanced Security)
- Rely on Trivy scans and artifact uploads instead of GitHub Security tab
- No auto-merge via branch protection (use Renovate's `platformAutomerge` instead)

### Google Cloud Free Tier

**ALL infrastructure and code changes MUST stay within GCP free tier limits. This is NON-NEGOTIABLE.**

**Monthly limits:**

- **Cloud Run**: 2 million requests/month, 360,000 GB-seconds/month, 180,000 vCPU-seconds/month
- **Cloud Storage**: 5 GB storage, 5,000 Class A operations/month, 50,000 Class B operations/month
- **Firestore**: 1 GB storage, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day
- **Cloud Build**: 120 build-minutes/day (for CI/CD)
- **Secret Manager**: 6 active secret versions (for API keys, if needed)

**If any suggestion would exceed free tier limits, STOP and ask for explicit approval first.**

### Infrastructure as Code

**ALL infrastructure MUST be declared in Terraform. NEVER suggest manual resource creation via console or `gcloud` CLI.**

- Infrastructure code goes in `infra/` directory
- Use Terraform modules for reusable components
- All resource names must be defined in `terraform.tfvars` or `variables.tf`
- Environment-specific values in separate tfvars files
- `gcloud` and `gsutil` commands are ONLY for troubleshooting, never for creating/modifying infrastructure

**Before suggesting any GCP resource, verify it fits within free tier limits and provide Terraform configuration.**

### Security & Public Repository

**This repository is PUBLIC and may be used by others. NEVER commit sensitive or project-specific configuration.**

- All `.tfvars` files are gitignored (project-specific Terraform variables)
- All `.env*` files are gitignored (environment variables, secrets, API keys)
- Service account keys and credentials are gitignored
- Use example/template files with `.example` suffix for documentation (e.g., `terraform.tfvars.example`)
- Document required variables in README or variable descriptions, never provide actual values
- Use GCP Secret Manager for runtime secrets, never hardcode in code or config files

## Architecture

### Streamlit Multi-Page App Structure

- **Entry point**: `app/_Home_.py` - Weather dashboard and outdoor tips (renamed from 🌲*Home*.py for testability)
- **Pages**: `app/pages/` with numbered emoji prefixes (e.g., `1_🥾_Hikes_map.py`)
  - Pages are auto-discovered by Streamlit via filename convention
  - Emoji prefixes in filenames control navigation order and display
- **Shared functions**: `app/functions/` - Core business logic (GPX parsing, track management, foraging data)
- **Resources**: `app/resources/` - Static data structures (foraging calendar, default types)

### Data Flow & State Management

- **Session state** (`st.session_state`) is the primary state container across page loads
- Key session state variables:
  - `trails`: List of Trail objects from Firestore (filtered by source)
  - `selected_trail_id`: Currently selected trail for sidebar display
  - `use_world_wide_hikes`: Toggle between Skåne trails and worldwide hikes
  - `foraging_data`: Month-indexed dict of foraging spots from Firestore
- **Persistence**: Firestore for all data (trails, statuses, foraging spots, foraging types)

### Directory Structure Conventions

- `app/tracks_gpx/planned_hikes/` - Official Skåneleden trail GPX files (bootstrapped to Firestore)
- `app/media/` - Static images for foraging guide
- `app/functions/` - Core business logic (Firestore clients, trail/foraging operations)
- `app/resources/` - Static data structures and defaults

## Development Workflows

### Running the App

```bash
# Using UV (recommended - faster, modern)
uv sync                          # Install dependencies
uv run streamlit run app/_Home_.py

# Or activate venv first
source .venv/bin/activate        # Linux/macOS
.venv\Scripts\activate          # Windows
streamlit run app/_Home_.py
```

Note: Must run from project root. Streamlit auto-discovers pages in `app/pages/`.

### Code Quality Tools

- **Package manager**: UV (Astral's fast Python package manager)
  - Replaces pip + virtualenv with single fast tool
  - Run: `uv sync` to install dependencies, `uv add <package>` to add new ones
- **Linter/Formatter**: Ruff (configured in `pyproject.toml`)
  - Line length: 120 characters
  - Target: Python 3.13
  - Ignores: D (docstrings), E501 (line length), T201 (print statements), COM812, and many style preferences
  - Run: `uv run ruff check --fix` or via pre-commit hooks
- **Pre-commit hooks**: `.pre-commit-config.yaml` enforces Ruff formatting on commit
  - Install: `uv run pre-commit install`
- **Security scanning**: `.github/workflows/security-checks.yml` runs on PRs, pushes, and weekly schedule
  - **SBOM generation**: Generates Software Bill of Materials for all dependencies
  - **License compliance**: Fails on GPL/LGPL/AGPL/SSPL licenses (copyleft)
  - **Vulnerability scanning**: Trivy scans for CVEs in dependencies
  - **Dependency review**: GitHub's dependency review on PRs
  - Suppress false positives in `.trivyignore`
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `ci:`, `docs:`, `refactor:`, `test:`, `deps:`, `perf:`, `revert:`, `bump:`
- **Git operations**: Use native `git` commands or GitHub CLI only
  - **NEVER use GitKraken MCP tools** - they are disabled for this project
  - Use `git` commands directly in terminal for all version control operations
  - Use `gh` (GitHub CLI) for pull requests and GitHub-specific operations if needed

### Python Environment

- Requires Python 3.11+ (configured for 3.13 in ruff)
- **Package manager**: UV (modern, fast alternative to pip)
  - `pyproject.toml` defines dependencies with optional groups: test, dev
  - `uv.lock` ensures reproducible installs
- Dependencies: See `pyproject.toml` [project.dependencies] (key: streamlit, folium, gpxpy, pandas, plotly)
- **Testing**: pytest with coverage (see `tests/` directory)
  - Run: `uv run pytest --cov=app`
  - Test fixtures in `tests/conftest.py`
  - Tests run in parallel with `pytest-xdist` (`-n auto`)

## Code Style

See `pyproject.toml` for tool configurations (ruff, pytest, etc.).

- **Ruff** for linting/formatting
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `ci:`, `docs:`, `refactor:`, `test:`, `deps:`, `perf:`, `revert:`, `bump:`
- Test files must match `test_*.py` pattern
- **Self-documenting code**: Avoid inline comments - code should be readable without them. Only add comments for complex logic or non-obvious design decisions.
- **Test coverage**: All new methods and modified functions must have corresponding tests.

## Test-Driven Development (TDD)

**Strongly prefer TDD when implementing new features or modules.** Write tests first, then implement the code to make them pass.

## Bug Fixes & Debugging Workflow

**CRITICAL: When a bug is reported or the app crashes, ALWAYS follow this workflow:**

1. **Run tests first** - Check if existing tests catch the bug: `uv run pytest tests/ -x -v`
1. **If tests don't catch it**, write a failing test that reproduces the bug
1. **Then fix the bug** - Make the minimum change to make the test pass
1. **Verify the fix** - Ensure the new test passes and no other tests broke

**DO NOT:**

- ❌ Jump straight to looking at terminal output and fixing based on error messages
- ❌ Fix bugs without adding regression tests (unless UI-only issues)
- ❌ Look at stack traces before checking if tests catch the issue

**Example workflow:**

```bash
# User reports: "The app crashes"
# Step 1: Run tests first
uv run pytest tests/ -x -v

# Step 2: If tests catch it, read the test failure output
# Step 3: Fix the code to make tests pass
# Step 4: Verify all tests pass

# If tests DON'T catch it:
# Step 2b: Write a test that reproduces the bug
# Step 3b: Fix the bug
# Step 4b: Verify the new test passes
```

**This ensures:**

- Every bug fix includes a regression test
- Tests become more comprehensive over time
- Future refactoring won't reintroduce the same bugs

**Test complexity guidelines:**

- Keep tests **simple and fast** - the suite runs in pre-commit hooks (~4 seconds target)
- Avoid expensive operations: large file I/O, network calls, complex computations
- Mock external dependencies rather than calling real APIs or databases
- If a test would be too complex or slow (e.g., full Streamlit UI interactions), document the bug fix without adding a test
- Prefer unit tests over integration tests for speed

### When to Use TDD

- **New modules or classes** - Write tests first to define the interface and behavior
- **New functions with complex logic** - Test edge cases before implementation
- **Bug fixes** - Write a failing test that reproduces the bug, then fix it
- **Refactoring** - Ensure tests pass before and after refactoring

### TDD Workflow

1. **Write a failing test** - Define expected behavior in a test that fails
1. **Implement minimal code** - Write just enough code to make the test pass
1. **Refactor** - Clean up code while keeping tests green
1. **Repeat** - Add more tests for edge cases and additional functionality

### Test Structure Guidelines

- **Use pytest fixtures** for setup and teardown (see `tests/conftest.py` for shared fixtures)
- **Mock external dependencies** - Mock Firestore, Secret Manager, file I/O, network calls
- **Test classes** - Group related tests in classes (e.g., `TestFirestoreClient`, `TestTrailStorage`)
- **Descriptive test names** - Test methods should clearly describe what they test
  - Good: `test_get_all_trails_empty()`, `test_save_trail_updates_timestamp()`
  - Bad: `test_trails()`, `test_function()`
- **Test coverage targets**:
  - New code: Aim for 100% coverage on new modules
  - Modified code: Ensure all changed lines are covered
  - Overall: Maintain >70% coverage across the codebase

### Test Organization

```python
class TestMyFeature:
    """Tests for MyFeature functionality."""

    def test_happy_path(self, mock_dependency):
        """Test the main success scenario."""
        # Arrange - set up test data
        # Act - call the function
        # Assert - verify results
        pass

    def test_edge_case_empty_input(self):
        """Test behavior with empty input."""
        pass

    def test_error_handling(self, mock_dependency):
        """Test proper error handling."""
        with pytest.raises(ValueError, match="Expected error message"):
            # Call function that should raise error
            pass
```

### Exceptions to TDD

TDD is **not required** for:

- **Streamlit UI code** - Visual/interactive components are hard to test
- **Simple glue code** - Trivial wrappers with no logic
- **Exploratory coding** - When spiking out ideas (but add tests before merging)
- **Hot fixes in production** - When time is critical (but add tests immediately after)

### Running Tests

```bash
# Run all tests with coverage
uv run pytest -n=auto --cov=app --cov-report=term-missing

# Run specific test file
uv run pytest tests/test_firestore_client.py -v

# Run specific test class or method
uv run pytest tests/test_firestore_client.py::TestFirestoreClient::test_get_client -v

# Watch mode (requires pytest-watch)
uv run ptw -- --cov=app
```

## Terraform Conventions

- **All infrastructure must be declared in Terraform** - no manual resource creation via console or CLI
- **Resource names** (buckets, databases, service accounts, etc.) must be defined in `terraform.tfvars` or `variables.tf`, never hardcoded in resource blocks
- **`gcloud` and `gsutil` commands** are only for troubleshooting, never for creating or modifying infrastructure
- Environment-specific values go in `infra/environments/{dev,prod}/terraform.tfvars`
- Shared module variables go in `infra/modules/*/variables.tf` with sensible defaults

## Key Patterns & Conventions

### GPX File Handling

- **Source**: GPX files downloaded from Garmin Connect (activities/tracks)
- **Parser**: `gpxpy` library for parsing GPX XML
- **Coordinate simplification**: RDP algorithm (`rdp` package) reduces track point density for map rendering
  - Applied via `simplify_track_coordinates()` in `functions/tracks.py`
  - Default tolerance: 0.0001 (balance between accuracy and performance)
- **File upload pattern**: Temp file validation → Parse test → Copy to destination
  - See `handle_uploaded_gpx()` in `functions/gpx.py`
- **Garmin format notes**: Files typically include metadata like timestamps, elevation, and heart rate data (though only lat/lng coordinates are currently used)

### Map Rendering Strategy

- **Library**: Folium for map generation, `streamlit_folium` for embedding
- **Track visualization**: Each track segment rendered as PolyLine with status-based colors
  - "Explored!" = green, "To Explore" = red
- **Performance**: Map regeneration triggered by state changes; use unique keys for `st_folium()` to prevent unnecessary re-renders
- **Center calculation**: Average of all track coordinates for initial map positioning

### Foraging Data Structure

- **Firestore collections**: `foraging_spots` and `foraging_types`
- **Spot schema**: `{"type": str, "lat": float, "lng": float, "notes": str, "month": str, "created_at": str, "last_updated": str}`
- **Type schema**: `{"icon": str}` with document ID as type name
- **Type customization**: Users can add custom foraging types with emoji icons
  - Defaults in `resources/foraging_resources.py`

### File Path Management

- **Absolute paths required**: Use `pathlib.Path(__file__).parent.parent.absolute()` to get app root
- **Directory auto-creation**: All data directories created via `os.makedirs(..., exist_ok=True)`
- **WSL compatibility**: Project runs on Windows with WSL shell; paths use forward slashes in code

## Integration Points

### External APIs

- **Weather data**: Open-Meteo API (no key required)
  - Endpoint: `https://api.open-meteo.com/v1/forecast`
  - Default location: (56.0, 13.5) - Southern Sweden
  - Used in Home page for 4-day forecast

### Data Persistence

- **Trails**: Stored in Firestore `trails` collection (Trail model)
  - Simplified coordinates (~50 points) for map rendering
  - Full coordinates in `trail_details` collection (TrailDetails model)
  - Trail sources: `planned_hikes`, `other_trails`, `world_wide_hikes`
  - Cached for 30 minutes with manual invalidation on mutations
- **Foraging data**: Stored in Firestore `foraging_spots` and `foraging_types` collections
  - Spots include: type, lat, lng, notes, month, created_at, last_updated
  - Types include: icon and other properties
  - Loaded per-month or all at once as needed

## Common Gotchas

### Streamlit-Specific

- **Session state persistence**: Changes to `st.session_state` persist across widget interactions but reset on full page reload
- **Rerun behavior**: `st.rerun()` refreshes the entire app; use after file uploads to reflect new data
- **Widget keys**: Must be unique across pages to avoid state conflicts (e.g., `key=f"foraging_map_{selected_month}"`)

### GPX Processing

- **Encoding**: Always open GPX files with `encoding="utf-8"` to handle special characters in track names
- **Multiple segments**: Tracks can have multiple segments; iterate through all to avoid missing coordinates
- **Empty coordinates check**: Always verify `len(coordinates) > 0` before processing/rendering

### Path Handling

- **Windows + WSL**: Use `os.path.join()` or pathlib for cross-platform compatibility
- **Relative imports**: Functions module uses relative imports (`from functions.gpx import ...`); maintain flat structure

## When Making Changes

### Adding New Pages

1. Create file in `app/pages/` with format `N_emoji_Name.py` (N = display order)
1. Include `st.set_page_config(layout="wide")` if full-width layout needed
1. Access shared session state directly; no imports needed

### Modifying GPX Logic

- Test with multiple trail sources: `planned_hikes` (Skåneleden trails), `other_trails` (local uploads), `world_wide_hikes` (international)
- Verify toggle behavior: `use_world_wide_hikes` filters trails from Firestore by source
- Trail operations use Firestore collections: `trails` (list view), `trail_details` (full data)
- Cache invalidation: Clear `load_all_trails()` cache after mutations (create, update, delete)

### Updating Foraging Features

- Changes to foraging spots use Firestore operations: `save_foraging_spot()`, `update_foraging_spot()`, `delete_foraging_spot()`
- Changes to foraging types use: `save_foraging_type()`, `delete_foraging_type()`
- Month names are short form ("Jan"-"Dec") and stored in the `month` field
- Calendar data in `resources/foraging_resources.py` is display-only (not used for validation)

### Testing & Deployment Considerations

- **Follow existing patterns** - Maintain consistency with current code structure
- **Free tier compliance** - All changes must stay within GCP free tier limits
  - Verify resource usage before implementing new features
  - Use Firestore batch operations to minimize read/write operations
  - Implement caching where appropriate to reduce API calls
- **Infrastructure as code** - All GCP resources must be defined in Terraform
  - No manual creation via console or gcloud CLI
  - Document resource limits and costs in terraform comments
- **Test with real data** - When modifying track parsing, test with actual Garmin GPX files to ensure compatibility

## Skills (AI Agent Instructions)

Skills in `.github/skills/` provide domain-specific instructions:

| Skill                       | Purpose                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `copilot-self-improvement/` | Meta-skill for maintaining Copilot config, skills, instructions |
| `local-development/`        | GCP secrets, .env setup, starting servers, troubleshooting      |
| `pr-review-workflow/`       | Handle PR creation, review comments, CI status using GitHub CLI |
| `security/`                 | Security best practices and preventing sensitive data leaks     |
| `working-context/`          | Track tasks and discovered issues across conversations          |

## Code Quality Principles

### Warnings and Errors

- **NEVER suppress or filter warnings** - Always fix the root cause
- Warnings exist to prevent bugs and compatibility issues
- If a test emits a warning, investigate and fix the underlying problem
- Examples of proper fixes:
  - Deprecation warnings: Update code to use the new API
  - Compatibility warnings: Adapt code to work with new library versions
  - Type warnings: Add proper type annotations or fix type mismatches
- Only acceptable exception: External library bugs that cannot be fixed locally (document why)
- Pytest is configured with `-W error` to treat all warnings as test failures

### Testing Philosophy

- Warnings treated as errors ensure code quality
- Fix issues at their source, not with configuration bandaids
- Test coverage targets 70%+ for business logic
- Exception paths must be tested

### Coverage Standards

- **Overall threshold**: Enforced by `fail_under` in `pyproject.toml` — pytest-cov will fail the run if coverage drops below this
- **Per-file minimum**: Every file in `app/` and `api/` must maintain high coverage — no file gets a pass for "bringing the average down"
- **`# pragma: no cover`**: Use for code that would only test mock wiring, not real logic (see `python-style-guide.instructions.md` Testing section for categories). Never use pragma to hide untested logic

### Pre-Commit Checklist

Before committing changes that add new functionality:

- [ ] **Zero compile/type errors** across the codebase — not just in files you touched
- [ ] Storage layer: Do mapping functions (`_doc_to_*`) include the new fields?
- [ ] Are those mappings tested with explicit assertions?
- [ ] Does coverage pass? (`uv run pytest --cov=app --cov=api` — threshold enforced by `pyproject.toml`)
- [ ] No single file dropped below the coverage threshold? (check `--cov-report=term-missing` output)

**Exceptions:** Terraform, config files, pure Streamlit UI styling.
