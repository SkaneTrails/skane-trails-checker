"""Resources and constants for hikes/trails functionality."""

from typing import TypedDict

# Difficulty levels for trail classification
DIFFICULTY_LEVELS = ["Easy", "Moderate", "Difficult", "Expert"]

# Regions in Skåne for filtering trails
SKANE_REGIONS = [
    "All Regions",
    "Northern Skåne",
    "Central Skåne",
    "Southern Skåne",
    "Coastal",
    "Söderåsen",
    "Kullaberg",
]

# Default distance filter range in km
DEFAULT_MIN_DISTANCE = 0.0
DEFAULT_MAX_DISTANCE = 100.0

# Distance filter step size
DISTANCE_STEP = 1.0


class TrackFilterState(TypedDict):
    """State for track filtering options."""

    search_query: str
    min_distance_km: float
    max_distance_km: float
    difficulty_levels: list[str]
    region: str
    show_explored_only: bool
    show_unexplored_only: bool
