______________________________________________________________________

## applyTo: "\*\*/\*.py"

# Firestore Schema Instructions

## Database Configuration

- **Database name**: `skane-trails-db` (NOT `(default)`)
- **Location**: `eur3`
- **Project ID**: Read from env var `FIRESTORE_PROJECT_ID` or `GOOGLE_CLOUD_PROJECT`
- **Database ID**: Read from env var `FIRESTORE_DATABASE_ID` or `FIRESTORE_DATABASE`

## Collections

### `trails` — Trail list data (map display)

| Field             | Type                         | Required | Description                                                  |
| ----------------- | ---------------------------- | -------- | ------------------------------------------------------------ |
| `name`            | `str`                        | ✅       | Trail display name                                           |
| `difficulty`      | `str`                        | ✅       | Trail difficulty level                                       |
| `length_km`       | `float`                      | ✅       | Trail length in kilometers                                   |
| `status`          | `str`                        | ✅       | `"To Explore"` or `"Explored!"`                              |
| `coordinates_map` | `list[{lat, lng}]`           | ✅       | Simplified coordinates (~50 points) for map rendering        |
| `bounds`          | `{north, south, east, west}` | ✅       | Geographic bounding box                                      |
| `center`          | `{lat, lng}`                 | ✅       | Center point for map positioning                             |
| `source`          | `str`                        | ✅       | `"planned_hikes"`, `"other_trails"`, or `"world_wide_hikes"` |
| `last_updated`    | `str`                        | ✅       | ISO timestamp                                                |
| `activity_date`   | `str`                        | ❌       | Date of hiking activity                                      |
| `activity_type`   | `str`                        | ❌       | Type of activity (hiking, running, etc.)                     |
| `elevation_gain`  | `float`                      | ❌       | Total elevation gain in meters                               |
| `elevation_loss`  | `float`                      | ❌       | Total elevation loss in meters                               |

**Document ID**: Must equal `trail_id` (same ID used by app/API via `document(trail_id)`).

### `trail_details` — Full trail data (single trail view)

| Field               | Type               | Required | Description                        |
| ------------------- | ------------------ | -------- | ---------------------------------- |
| `coordinates_full`  | `list[{lat, lng}]` | ✅       | Full-resolution coordinate list    |
| `elevation_profile` | `list[float]`      | ❌       | Elevation at each coordinate point |
| `waypoints`         | `list[dict]`       | ❌       | Named points along the trail       |
| `statistics`        | `dict`             | ❌       | Computed trail statistics          |

**Document ID**: Same as corresponding `trails` document.

### `foraging_spots` — Foraging locations

| Field          | Type    | Required | Description                                          |
| -------------- | ------- | -------- | ---------------------------------------------------- |
| `type`         | `str`   | ✅       | Foraging type name (matches `foraging_types` doc ID) |
| `lat`          | `float` | ✅       | Latitude (-90 to 90)                                 |
| `lng`          | `float` | ✅       | Longitude (-180 to 180)                              |
| `notes`        | `str`   | ❌       | User notes about the spot                            |
| `month`        | `str`   | ✅       | Short month name: `Jan`, `Feb`, ..., `Dec`           |
| `date`         | `str`   | ❌       | Specific date                                        |
| `created_at`   | `str`   | ✅       | ISO timestamp                                        |
| `last_updated` | `str`   | ✅       | ISO timestamp                                        |

### `foraging_types` — Foraging type definitions

| Field   | Type  | Required | Description             |
| ------- | ----- | -------- | ----------------------- |
| `icon`  | `str` | ✅       | Emoji icon for the type |
| `color` | `str` | ❌       | Display color           |

**Document ID**: Type name (e.g., `"Blueberry"`, `"Chanterelle"`).

### `places` — Points of interest (Skåneleden)

| Field          | Type                       | Required | Description                           |
| -------------- | -------------------------- | -------- | ------------------------------------- |
| `name`         | `str`                      | ✅       | Place name                            |
| `lat`          | `float`                    | ✅       | Latitude                              |
| `lng`          | `float`                    | ✅       | Longitude                             |
| `categories`   | `list[{name, slug, icon}]` | ✅       | Place categories                      |
| `address`      | `str`                      | ❌       | Street address                        |
| `city`         | `str`                      | ❌       | City name                             |
| `weburl`       | `str`                      | ❌       | Website URL                           |
| `source`       | `str`                      | ✅       | Data source (default: `"skaneleden"`) |
| `last_updated` | `str`                      | ✅       | ISO timestamp                         |

## Common Schema Mistakes

| Mistake                                    | Correct                                     |
| ------------------------------------------ | ------------------------------------------- |
| Storing coordinates as `[lat, lng]` arrays | Use `{lat, lng}` objects                    |
| Using full month names (`"January"`)       | Use 3-letter abbreviations (`"Jan"`)        |
| Storing status as boolean                  | Use string: `"To Explore"` or `"Explored!"` |
| Hardcoding database name in code           | Read from `FIRESTORE_DATABASE_ID` env var   |
| Missing `last_updated` on mutations        | Always set on create and update             |

## Storage Layer Conventions

- All Firestore operations go through `app/functions/` or `api/storage/`
- Mapping functions (`_doc_to_trail`, `_doc_to_foraging_spot`, etc.) must include ALL fields
- New fields require: model update + mapping update + test assertions
- Use Firestore batch operations to stay within free tier write limits
