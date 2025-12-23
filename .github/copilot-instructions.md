# Skåne Trails Checker - AI Coding Agent Instructions

## Important: Collaboration Guidelines

You are collaborating with a human who may make changes between your edits:

- **Always re-verify** file contents before making changes - don't assume previous state
- **If your previous changes are gone**, do not re-add them without checking with the user first
- **Read before editing** - the human may have modified, moved, or intentionally removed content
- **Verify suggestions** - when given review comments or suggestions, verify they are correct against actual code before applying. If a suggestion is incorrect, point that out rather than blindly applying it
- **Compare alternatives** - when the user suggests a different approach, analyze both options and explain the tradeoffs before implementing. Don't assume the user's suggestion is better - justify the choice
- **Troubleshoot step-by-step** - when debugging or troubleshooting, suggest one fix at a time and wait for the result before suggesting the next step. Don't overwhelm with multiple suggestions at once
- **Plan before large changes** - for complex changes (3+ files, new infrastructure, architectural changes), propose a high-level plan first and wait for approval before implementing
- **Prefer standard git tools** - use `git` commands and `gh` CLI over GitKraken MCP tools. GitKraken tools should only be used when explicitly requested or when they provide functionality not available through standard tools
- **Solve the actual problem** - when hitting obstacles (permissions, cross-repo dependencies, missing APIs), do not suggest workarounds that avoid the problem instead of solving it. If the goal is "validate X" and validation requires extra permissions, the answer is "add the permissions" not "skip validation." Never present a workaround as equivalent to a real solution.

## Keeping Instructions Current

When reviewing PRs, check if changes affect this documentation:

- New/renamed/removed workflows in `.github/workflows/`
- Changes to code style tools (ruff, pre-commit hooks, etc.)
- New dependencies or architectural patterns
- Changes to testing patterns or conventions

If any of these change, suggest updating `.github/copilot-instructions.md` in your review.

**Important:** This file is strictly for Copilot. All changes must be assessed for relevance to AI-assisted coding (writing, reviewing, debugging, and troubleshooting code). If a suggested change wouldn't help Copilot with these tasks, point that out. Do not add operational, access, or administrative information that doesn't affect code or troubleshooting.

## Project Overview

A Streamlit multi-page application for tracking hiking trails and foraging spots in Skåne, Sweden. The app processes GPX files, manages trail completion statuses, and provides interactive maps for both hiking trails and seasonal foraging locations.

**Deployment target**: Google Cloud Platform under **FREE TIER** constraints.

## Critical Constraints

### Google Cloud Free Tier Requirements

**ALL infrastructure and code changes MUST stay within GCP free tier limits. This is NON-NEGOTIABLE.**

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
  - `gpx_data`: Parsed GPX tracks (main Skåneleden trails)
  - `additional_tracks`: User-uploaded or regional trails
  - `track_status`: Dict mapping track IDs to status ("To Explore" | "Explored!")
  - `foraging_data`: Month-indexed dict of foraging spots with lat/lng
  - `use_world_wide_hikes`: Toggle between Skåne trails and worldwide hikes
- **Persistence**: CSV files for track statuses (`tracks_status/`), JSON for foraging types (`foraging_data/`)
  - **Migration planned**: Moving to Cloud Storage for GPX files and Firestore for statuses/foraging data

### Cloud Deployment Architecture (Planned)

- **Cloud Run**: Hosts Streamlit app container
  - Serverless, pay-per-use (fits free tier with 2M requests/month)
  - Scales to zero when not in use (no cost when idle)
  - Memory limit: 512 MB (within free tier GB-seconds allocation)
- **Cloud Storage**: Stores GPX trail files
  - Replaces local `tracks_gpx/` directory structure
  - 5 GB free tier (current GPX files are ~10 MB)
- **Firestore**: Stores track statuses and foraging data
  - Replaces CSV/JSON files with real-time NoSQL database
  - 1 GB storage, 50K reads/day, 20K writes/day free tier
- **Container Registry**: Stores Docker images for Cloud Run
  - 0.5 GB free tier storage
- **CI/CD**: GitHub Actions triggers Cloud Build on push
  - 120 build-minutes/day free tier

### Directory Structure Conventions

- `tracks_gpx/skaneleden/` - Official Skåneleden trail GPX files
- `tracks_gpx/other_trails/` - Regional supplementary trails
- `tracks_gpx/world_wide_hikes/` - User-uploaded international hikes
- `app/foraging_data/` - Foraging spots CSV and types JSON
- `app/media/` - Static images for foraging guide

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

- **Monthly organization**: Dict keys are short month names (Jan-Dec)
- **Spot schema**: `{"type": str, "lat": float, "lng": float, "notes": str, "date": str}`
- **Type customization**: Users can add custom foraging types with emoji icons
  - Stored in `foraging_types.json` with `{"icon": str}` structure
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

- **Track statuses**: CSV with columns `[track_id, status, last_updated]`
  - Auto-save on status change and manual "Save Track Status" button
- **Foraging data**: Single CSV with all months' data, loaded into memory on app start
  - Saved via `Foraging.save_foraging_data()` after each modification

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
2. Include `st.set_page_config(layout="wide")` if full-width layout needed
3. Access shared session state directly; no imports needed

### Modifying GPX Logic

- Test with multiple track types: Skåneleden (single GPX, multiple tracks), other trails (multiple GPX files), world-wide hikes
- Verify toggle behavior: `use_world_wide_hikes` changes data source and file upload destination

### Updating Foraging Features

- Changes to `foraging_types` require updating both session state and JSON file
- Month names are hardcoded as short form ("Jan"-"Dec"); maintain consistency
- Calendar data in `resources/foraging_resources.py` is display-only (not used for validation)

### Testing & Deployment Considerations

- **Follow existing patterns** - Maintain consistency with current code structure until refactoring is complete
- **Cloud deployment constraints** - Keep in mind startup time and memory limits when making architectural decisions
  - Cloud Run free tier: 512 MB memory limit, 2M requests/month
  - Design for fast cold starts (< 5 seconds)
  - Minimize dependencies and container size
- **Free tier compliance** - All changes must stay within GCP free tier limits
  - Verify resource usage before implementing new features
  - Use Firestore batch operations to minimize read/write operations
  - Implement caching where appropriate to reduce API calls
- **Infrastructure as code** - All GCP resources must be defined in Terraform
  - No manual creation via console or gcloud CLI
  - Document resource limits and costs in terraform comments
- **Test with real data** - When modifying track parsing, test with actual Garmin GPX files to ensure compatibility
- **Backwards compatibility** - Maintain compatibility with existing CSV/JSON data files during migration

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
