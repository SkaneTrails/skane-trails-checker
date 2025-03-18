# Skåne Trails Tracking app

This application processes GPX files and manages track statuses for various trails.

## Prerequisites

- Python 3.11 or higher
- `pip` package manager

## Installation

1. Clone the repository

2. Create a virtual environment

3. Install the required packages:
    ```sh
    pip install -r requirements.txt
    ```
## Usage

1. Ensure you have the necessary GPX files and directories:
    - `tracks_gpx/skaneleden/all-skane-trails.gpx`
    - `tracks_gpx/other_trails/`
    - `tracks_status/track_skaneleden_status.csv` (optional, will be created if not present)

2. Run the application:
    ```sh
    streamlit run app_maps.py
    ```

3. Follow the prompts or instructions provided by the application.

## Notes

- The application will create necessary directories if they do not exist.
- Track statuses will be loaded from and saved to `tracks_status/track_skaneleden_status.csv`.
