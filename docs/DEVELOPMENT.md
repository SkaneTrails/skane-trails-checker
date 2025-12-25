# Development Guide

This guide covers the technical architecture, design patterns, and implementation details for developers working on the codebase.

> **For contribution guidelines**, see [CONTRIBUTING.md](../CONTRIBUTING.md)

## Quick Reference

```bash
# Run app
uv run streamlit run app/_Home_.py

# Run tests
uv run pytest --cov=app

# Lint/format
uv run ruff check --fix && uv run ruff format
```

## Project Architecture

### Streamlit Multi-Page App Structure

- **Entry point**: `app/_Home_.py`
- **Pages**: Auto-discovered from `app/pages/` directory
- **Naming**: `N_emoji_Name.py` (N = display order)

### State Management

Streamlit session state (`st.session_state`) is the primary state container:

```python
# Initialize state
if "gpx_data" not in st.session_state:
    st.session_state.gpx_data = load_gpx_data()

# Access state
tracks = st.session_state.gpx_data

# Modify state
st.session_state.track_status[track_id] = "Explored!"
```

### Data Flow

1. **GPX Files** → `functions/gpx.py` → Parse tracks
1. **Track Status** → `functions/tracks.py` → Load/save CSV
1. **Foraging Data** → `functions/foraging.py` → Load/save JSON
1. **Map Rendering** → Folium → `streamlit_folium` → Display

### Key Patterns

#### GPX File Handling

```python
from functions.gpx import parse_gpx_file, simplify_track_coordinates

tracks = parse_gpx_file(filepath)
simplified = simplify_track_coordinates(tracks, tolerance=0.0001)
```

#### Track Status Management

```python
from functions.tracks import load_track_status, save_track_status

status = load_track_status("skaneleden")
status[track_id] = "Explored!"
save_track_status(status, "skaneleden")
```

#### Map Rendering

```python
import folium
from streamlit_folium import st_folium

m = folium.Map(location=[center_lat, center_lng], zoom_start=10)
folium.PolyLine(coordinates, color="green").add_to(m)
st_folium(m, width=1200, height=600)
```

## Debugging

### Enable Debug Logging

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Streamlit Debug Mode

```bash
streamlit run app/_Home_.py --logger.level=debug
```

### Check Debug Log

The app creates `app_debug.log` with:

- Python version
- Working directory
- Streamlit version
- Error tracebacks

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.

## Performance Considerations

### GPX Coordinate Simplification

- Use RDP algorithm to reduce point density
- Default tolerance: 0.0001 (balance accuracy vs performance)
- Apply before map rendering: `simplify_track_coordinates()`

### Map Rendering

- Generate map only when needed (state changes)
- Use unique keys for `st_folium()` to prevent unnecessary re-renders
- Limit number of tracks displayed simultaneously

### Session State

- Minimize data stored in session state
- Use lazy loading where possible
- Clear unused state variables

## Dependency Management

### Adding Dependencies

```bash
# Add production dependency
uv add package-name

# Add development dependency
uv add --dev package-name

# Add with version constraint
uv add "package-name>=1.0.0"
```

### Updating Dependencies

Renovate automatically creates PRs for dependency updates. Manual updates:

```bash
# Update all dependencies
uv sync --upgrade

# Update specific package
uv sync --upgrade-package package-name
```

### Lock File

- `uv.lock` ensures reproducible installs
- Committed to git
- Regenerated on dependency changes

## CI/CD

### GitHub Actions Workflows

- **tests.yml** - Run tests on PRs and pushes
- **security-checks.yml** - License scanning, Trivy vulnerability scanning
- **renovate.yml** - Automated dependency updates
- **auto-label-pr.yml** - Auto-label PRs based on changes

### Security Scanning

- **License compliance**: Fails on GPL/LGPL/AGPL/SSPL licenses
- **Vulnerability scanning**: Trivy scans for CVEs
- **SBOM generation**: Creates Software Bill of Materials

Suppress false positives in `.trivyignore`

## Future Architecture

See GitHub issues #35-#40 for Firebase migration roadmap:

1. **Abstract storage layer** - Decouple business logic from file storage
1. **Firebase/Firestore** - Cloud storage for GPX files and data
1. **Docker/Cloud Run** - Containerized deployment
1. **Zero-cost production** - Deploy on GCP free tier

## Questions?

- Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Open a [GitHub Issue](https://github.com/SkaneTrails/skane-trails-checker/issues)
- Read [copilot-instructions.md](../.github/copilot-instructions.md) for AI coding agent guidelines
