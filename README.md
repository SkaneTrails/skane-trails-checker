# Skåne Trails Tracking app

This application processes GPX files and manages track statuses for various trails.

## Prerequisites

- Python 3.11 or higher
- `uv` package manager (recommended) or `pip`

## Installation

### Using UV (Recommended - Fast & Modern)

1. Install UV:
    ```sh
    # Windows (PowerShell)
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

    # Linux/macOS
    curl -LsSf https://astral.sh/uv/install.sh | sh
    ```

2. Clone the repository

3. Install dependencies (creates `.venv` automatically):
    ```sh
    uv sync
    ```
## Usage

1. Ensure you have the necessary GPX files and directories:
    - `tracks_gpx/skaneleden/all-skane-trails.gpx`
    - `tracks_gpx/other_trails/`
    - `tracks_status/track_skaneleden_status.csv` (optional, will be created if not present)

2. Run the application:
    ```sh
    # Using UV (recommended)
    uv run streamlit run app/🌲_Home_.py

    # Or activate venv first
    source .venv/bin/activate  # Linux/macOS
    .venv\Scripts\activate     # Windows
    streamlit run app/🌲_Home_.py
    ```

3. Follow the prompts or instructions provided by the application.

## Development

### Running Tests
```sh
# Using UV
uv run pytest

# With coverage
uv run pytest --cov=app --cov-report=html

# Using pip
pytest
```

### Code Formatting
```sh
# Using UV
uv run ruff check --fix
uv run ruff format

# Using pip
ruff check --fix
ruff format
```

### Pre-commit Hooks
```sh
uv run pre-commit install
uv run pre-commit run --all-files
```

## Notes

- The application will create necessary directories if they do not exist.
- Track statuses will be loaded from and saved to `tracks_status/track_skaneleden_status.csv`.
