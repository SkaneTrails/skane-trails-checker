# Skåne Trails Checker - AI Coding Agent Instructions

## Project Overview
A Streamlit multi-page application for tracking hiking trails and foraging spots in Skåne, Sweden. The app processes GPX files, manages trail completion statuses, and provides interactive maps for both hiking trails and seasonal foraging locations.

## Architecture

### Streamlit Multi-Page App Structure
- **Entry point**: `app/🌲_Home_.py` - Weather dashboard and outdoor tips
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
uv run streamlit run app/🌲_Home_.py

# Or activate venv first
source .venv/bin/activate        # Linux/macOS
.venv\Scripts\activate          # Windows
streamlit run app/🌲_Home_.py
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

### Deployment
- **Current**: Runs locally via `streamlit run`
- **Planned**: Google Cloud deployment under free tier
- Design decisions should consider cloud deployment constraints (startup time, memory limits)

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

## Project Direction & Contributing

### Current Priorities (see GitHub Issues for details)
1. **Code cleanup**: Separating business logic from UI code
   - Move more logic from page files into `app/functions/`
   - Reduce code duplication across pages
2. **Test coverage**: Expand automated tests
   - Core functions have unit tests in `tests/`
   - Need integration tests for Streamlit pages
3. **Cloud deployment**: Prepare for Google Cloud deployment
   - Optimize cold start performance
   - Consider stateless session handling

### Architecture Goals
- Better separation of concerns (presentation vs. business logic)
- More modular functions for testability
- Maintain backwards compatibility with existing CSV/JSON data files

### When Contributing
- Check GitHub Issues for current tasks and feature requests
- Follow existing patterns until refactoring is complete
- Keep cloud deployment constraints in mind (memory, startup time)
- Test with real Garmin GPX files when modifying track parsing
