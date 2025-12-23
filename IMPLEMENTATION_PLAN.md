# Implementation Plan: Trail Distance & Filtering Features

Two features to implement in separate branches.

---

## 🎯 Feature 1: Calculate Trail Distance

**Branch:** `feature/trail-distance`

**Goal:** Compute and display total distance for each trail using GPX track points.

### Implementation Steps

1. **Add `calculate_track_distance()` function** to `app/functions/tracks.py`
   - Use `geopy.distance.geodesic()` (already a dependency) to sum distances between consecutive points
   - Handle multiple segments per track
   - Return distance in km

2. **Create `TrackMetadata` TypedDict** to store computed data:
   ```python
   class TrackMetadata(TypedDict):
       distance_km: float
       segment_count: int
       point_count: int
   ```

3. **Update `1_🥾_Hikes_map.py`:**
   - Calculate distances when loading tracks
   - Store in `st.session_state.track_distances`
   - Display total distance in Track Statistics section
   - Add distance to each track popup on map

### Files to Modify
- `app/functions/tracks.py` - Add distance calculation
- `app/pages/1_🥾_Hikes_map.py` - Display distances
- `tests/test_track_functions.py` - Add unit tests

---

## 🎯 Feature 2: Trail Filtering & Search

**Branch:** `feature/trail-filtering`

**Goal:** Allow users to filter trails by difficulty, length, and location.

### Implementation Steps

1. **Define trail metadata schema** in `app/resources/hikes_resources.py`:
   ```python
   DIFFICULTY_LEVELS = ["Easy", "Moderate", "Difficult", "Expert"]
   REGIONS = ["Northern Skåne", "Central Skåne", "Southern Skåne", "Coastal"]
   ```

2. **Add filtering functions** to `app/functions/tracks.py`:
   - Filter by distance range (min/max km)
   - Filter by difficulty level (requires Feature 1)
   - Filter by region/location
   - Search by track name

3. **Update UI** in `1_🥾_Hikes_map.py`:
   - Add filter controls in sidebar (col1)
   - Distance range slider
   - Difficulty multi-select
   - Region dropdown
   - Search text input
   - "Clear Filters" button

4. Store filter state in session to persist across reruns

### Files to Modify
- `app/resources/hikes_resources.py` - Add filter constants
- `app/functions/tracks.py` - Add filtering logic
- `app/pages/1_🥾_Hikes_map.py` - Add filter UI
- `tests/test_track_functions.py` - Add filter tests

---

## Implementation Order

1. ✅ Start with **Feature 1 (Trail Distance)** - provides data needed for filtering by length
2. Then implement **Feature 2 (Filtering)** - builds on distance calculations
