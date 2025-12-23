# Skåne Trails Checker

A Streamlit multi-page application for tracking hiking trails and foraging spots in Skåne, Sweden.

## What It Does

**Skåne Trails Checker** helps you plan and track outdoor adventures in southern Sweden:

- 🥾 **Interactive Trail Maps** - Visualize Skåneleden trails and regional hikes with color-coded completion status
- 📊 **Progress Tracking** - Mark trails as "To Explore" or "Explored!" and save your hiking history
- 🌿 **Foraging Guide** - Track seasonal foraging locations (mushrooms, berries, herbs) on an interactive map
- 🌤️ **Weather Integration** - 4-day weather forecast for planning your next hike
- 📁 **GPX File Support** - Upload your own Garmin/GPS tracks to add custom trails

## Features

### 1. Trail Visualization

- Official Skåneleden trails (5 routes totaling ~1,000 km)
- Regional trails in Skåne (Hovdala, Fulltofta, Romele, etc.)
- Toggle to worldwide hikes view (user-uploaded GPX files)
- Interactive Folium maps with segment-by-segment tracking

### 2. Data Management

- Track completion status saved to CSV
- Foraging spots organized by month with custom type definitions
- GPX file parsing with coordinate simplification for performance

### 3. Multi-Page Navigation

- **Home**: Weather dashboard and outdoor tips
- **Hikes Map**: Trail visualization and status management
- **Foraging Spots**: Seasonal foraging location guide

## Quick Start

### Prerequisites

- Python 3.14+
- [UV package manager](https://github.com/astral-sh/uv)

### Installation

```bash
# Install UV (if not already installed)
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# Linux/macOS
curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone and set up
git clone https://github.com/SkaneTrails/skane-trails-checker.git
cd skane-trails-checker
uv sync --extra dev  # Install all dependencies including dev tools
```

### Local Development Setup

**First-time setup requires Firestore connection configuration:**

1. **Authenticate with Google Cloud:**

   ```bash
   gcloud auth application-default login
   ```

2. **Fetch Firestore secrets from GCP Secret Manager:**

   ```bash
   uv run python dev-tools/setup_env.py
   ```

   This creates a `.env` file with Firestore connection details. The file is automatically gitignored.

   **Options:**
   - `--force` - Force refresh even if .env is fresh
   - `--check` - Validate .env has all required variables
   - `--list` - Show secret mappings

   See [dev-tools/README.md](dev-tools/README.md) for troubleshooting.

### Running the App

```bash
# Using UV (recommended)
uv run streamlit run app/_Home_.py

# Or activate venv first
source .venv/bin/activate  # Linux/macOS
.venv\Scripts\activate     # Windows
streamlit run app/_Home_.py
```

The app will open in your browser at `http://localhost:8501`

## Project Structure

```plaintext
skane-trails-checker/
├── app/
│   ├── _Home_.py              # Entry point - weather dashboard
│   ├── pages/                 # Streamlit pages (auto-discovered)
│   │   ├── 1_🥾_Hikes_map.py
│   │   └── 2_🌿_Foraging_spots.py
│   ├── functions/             # Core business logic
│   │   ├── gpx.py            # GPX parsing and file handling
│   │   ├── tracks.py         # Track management and status
│   │   └── foraging.py       # Foraging data operations
│   ├── resources/            # Static data and configs
│   └── foraging_data/        # Foraging spots and types (CSV/JSON)
├── tracks_gpx/               # GPX trail files
│   ├── skaneleden/          # Official Skåneleden trails
│   ├── other_trails/        # Regional trails in Skåne
│   └── world_wide_hikes/    # Worldwide hikes (user uploads)
├── tracks_status/           # Track completion CSV files
├── tests/                   # Test suite (97% coverage)
└── docs/                    # Additional documentation
```

## Development

### Running Tests

```bash
uv run pytest                          # Run all tests
uv run pytest --cov=app --cov-report=html  # With coverage report
```

### Code Quality

```bash
uv run ruff check --fix    # Lint and auto-fix
uv run ruff format         # Format code
uv run pre-commit install  # Set up pre-commit hooks
```

### Adding Your Own Trails

1. Export GPX file from Garmin Connect or similar service
2. Use the file uploader in the "Hikes Map" page
3. Toggle between Skåne trails (default) or worldwide hikes view
4. Uploaded trails are saved to the worldwide hikes collection

## Technology Stack

- **Framework**: Streamlit (interactive web app)
- **Maps**: Folium + OpenStreetMap
- **GPX Parsing**: gpxpy
- **Data**: Pandas (CSV/JSON), RDP algorithm (coordinate simplification)
- **Weather**: Open-Meteo API (free, no key required)
- **Package Manager**: UV (modern pip replacement)

## Future Plans

See [GitHub Issues](https://github.com/SkaneTrails/skane-trails-checker/issues) for the roadmap:

## Contributing

Contributions welcome! Please:

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
2. Fork the repository
3. Create a feature branch (`git checkout -b feat/amazing-feature`)
4. Follow conventional commit format (`feat:`, `fix:`, `chore:`, etc.)
5. Ensure tests pass (`uv run pytest`)
6. Submit a pull request

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for technical architecture and patterns.

## Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common issues and solutions.
