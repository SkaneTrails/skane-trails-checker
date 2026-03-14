# Development Tools

This directory contains utilities for local development setup and maintenance.

## Setup Environment Script

### `setup_env.py`

Automatically fetches Firestore connection details from GCP Secret Manager and creates a `.env` file for local development.

#### Prerequisites

1. **Google Cloud SDK** installed and authenticated:

   ```bash
   gcloud auth application-default login
   ```

1. **IAM Permissions**: Your user must have `roles/secretmanager.secretAccessor` role

1. **Python Dependencies**: Install dev dependencies with:

   ```bash
   uv sync --extra dev
   ```

#### Usage

**First time setup:**

```bash
uv run python dev-tools/setup_env.py
```

This will:

- Check if `.env` exists and is fresh (< 24 hours old)
- If not, fetch secrets from Secret Manager
- Create/update `.env` file with Firestore connection details
- Set file permissions to 600 (owner read/write only)

**Force refresh:**

```bash
uv run python dev-tools/setup_env.py --force
```

**Validate `.env` file:**

```bash
uv run python dev-tools/setup_env.py --check
```

**List secret mappings:**

```bash
uv run python dev-tools/setup_env.py --list
```

#### How It Works

1. **Environment Detection**: Reads `ENV` variable from `.env` (defaults to `dev`)
1. **Secret Mapping**: Uses `secret_mappings.yaml` to map Secret Manager secret names to environment variable names
1. **Fetch from GCP**: Retrieves latest versions of secrets using Secret Manager API
1. **Write `.env`**: Creates/updates `.env` file with fetched values
1. **Freshness Check**: Skips fetching if `.env` is less than 24 hours old (override with `--force`)

#### Troubleshooting

**Error: "Failed to get GCP project from gcloud"**

```bash
# Set your GCP project
gcloud config set project YOUR_PROJECT_ID

# Re-authenticate
gcloud auth application-default login
```

**Error: "Failed to fetch secret 'SECRET_NAME'"**

Possible causes:

1. Secret doesn't exist yet:

   ```bash
   # List available secrets
   gcloud secrets list
   ```

1. Missing permissions:

   ```bash
   # Check your IAM roles
   gcloud projects get-iam-policy YOUR_PROJECT_ID --flatten="bindings[].members" --filter="bindings.members:user:YOUR_EMAIL"
   ```

1. Secret Manager API not enabled:

   ```bash
   # Enable the API
   gcloud services enable secretmanager.googleapis.com
   ```

**Error: "gcloud CLI not found"**

Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install

#### Secret Mappings

Current mappings for `dev` environment:

| Secret Manager Secret     | Environment Variable |
| ------------------------- | -------------------- |
| `firestore-database-name` | `FIRESTORE_DATABASE` |
| `firestore-project-id`    | `GCP_PROJECT_ID`     |
| `firestore-location-id`   | `FIRESTORE_LOCATION` |

To add new secrets:

1. Create secret in Secret Manager (via Terraform recommended)
1. Add mapping to `secret_mappings.yaml`
1. Run `uv run python dev-tools/setup_env.py --force`

#### Security Notes

- `.env` files are **gitignored** - never commit them
- File permissions are set to 600 (owner-only read/write)
- Secrets are fetched on-demand, not stored in code
- Use Secret Manager as the single source of truth for configuration

## Skåneleden Trail Updater

### `update_skaneleden_trails.py`

Downloads, merges, and simplifies official Skåneleden trail GPX files from skaneleden.se into a single `all-skane-trails.gpx` file.

#### Usage

```bash
uv run python dev-tools/update_skaneleden_trails.py
```

This script performs three steps automatically:

1. **Download**: Fetches all 169 etapp GPX files from the official Skåneleden website
1. **Merge**: Combines them into a single GPX file with proper trail names (format: "SL# Trail Name, Etapp: etapp-name")
1. **Simplify**: Applies RDP algorithm to reduce file size while maintaining ~5m accuracy

#### Output

- **Temporary files**: `dev-tools/skaneleden_gpx/` (created during download, can be deleted)
- **Final output**: `app/tracks_gpx/planned_hikes/all-skane-trails.gpx`
  - ~156 tracks (169 etapps, some files contain multiple segments)
  - ~21,000 points
  - ~2 MB file size

#### After Running

Bootstrap the new trails into Firestore:

```bash
# Clear old planned trails first
uv run python dev-tools/delete_planned_trails.py

# Re-bootstrap from updated GPX
uv run python -c "from app.functions.bootstrap_trails import bootstrap_planned_trails; bootstrap_planned_trails('app/tracks_gpx/planned_hikes/all-skane-trails.gpx')"
```

The bootstrap function is idempotent — it skips if `planned_hikes` trails already exist.

#### Notes

- Downloads ~146 GPX files automatically (23 etapps don't have GPX files on the website)
- Handles both track-format (`<trk>`) and route-format (`<rte>`) GPX files
- Some GPX files contain multiple track segments, resulting in 156 tracks from 169 etapps
- Uses RDP simplification with tolerance 0.00005 (~5m accuracy, ~80% size reduction)

## Database Manager

### `db_manager.py`

Unified Firestore database management tool with both interactive and CLI modes. Covers all collections: trails, places, foraging spots, foraging types, and hike groups.

#### Prerequisites

Requires a configured `.env` file. Run `setup_env.py` first (see above).

#### Usage

**Interactive mode** (menu-driven):

```bash
uv run python dev-tools/db_manager.py
```

**CLI mode** (direct commands):

```bash
# Overview of all collections
uv run python dev-tools/db_manager.py status

# Trails
uv run python dev-tools/db_manager.py trails list
uv run python dev-tools/db_manager.py trails list --source planned_hikes
uv run python dev-tools/db_manager.py trails get <trail_id>
uv run python dev-tools/db_manager.py trails search "söderåsen"
uv run python dev-tools/db_manager.py trails stats

# Import GPX files (with duplicate detection)
uv run python dev-tools/db_manager.py trails import --gpx-dir path/to/folder/
uv run python dev-tools/db_manager.py trails import --gpx-dir path/to/folder/ --source other_trails
uv run python dev-tools/db_manager.py trails import --gpx-dir path/to/folder/ --dry-run
uv run python dev-tools/db_manager.py trails import --gpx-dir path/to/folder/ --duplicates replace

# Places
uv run python dev-tools/db_manager.py places list
uv run python dev-tools/db_manager.py places list --category parkering --limit 10
uv run python dev-tools/db_manager.py places get <place_id>
uv run python dev-tools/db_manager.py places stats
uv run python dev-tools/db_manager.py places search "Söderåsen"

# Foraging
uv run python dev-tools/db_manager.py foraging list
uv run python dev-tools/db_manager.py foraging list --month Jun
uv run python dev-tools/db_manager.py foraging types
uv run python dev-tools/db_manager.py foraging stats

# Hike groups
uv run python dev-tools/db_manager.py groups list
```

The tool shows the connected project and database on every run. If credentials are missing, it displays a clear error message with setup instructions.

#### Trail Search

Case-insensitive substring search across trail names:

```bash
uv run python dev-tools/db_manager.py trails search "vellinge"
```

Output includes trail ID, name, distance, duration, elevation status, and activity date.

#### Trail Details

`trails get` shows all available metadata for a trail:

- Name, status, source, length, difficulty
- Activity date and type (walking, cycling, etc.)
- Duration, elevation gain/loss, inclination (avg/max)
- Coordinate count and whether they include elevation data
- Geographic bounds
- Timestamps (created, updated)

#### GPX Import

Import GPX files into Firestore with automatic duplicate detection:

```bash
# Import all GPX files from a directory
uv run python dev-tools/db_manager.py trails import --gpx-dir path/to/folder/

# Preview without writing
uv run python dev-tools/db_manager.py trails import --gpx-dir path/to/folder/ --dry-run

# Set trail source (default: other_trails)
uv run python dev-tools/db_manager.py trails import --gpx-dir path/to/folder/ --source world_wide_hikes
```

Note: Only reads `.gpx` files directly in the given directory (not recursive).

**Duplicate detection** matches by activity date (±60 min window), falling back to exact name match. Control behavior with `--duplicates`:

| Flag                     | Behavior                          |
| ------------------------ | --------------------------------- |
| `--duplicates skip`      | Skip duplicates (default)         |
| `--duplicates replace`   | Overwrite existing with new data  |
| `--duplicates keep-both` | Import as new trail alongside old |

The import pipeline preserves elevation data, extracts duration from timestamps, and computes inclination metrics.

## Other Tools

### Trail Management

- **`delete_planned_trails.py`**: Delete all `planned_hikes` trails from Firestore (useful before re-bootstrapping)
- **`delete_all_trails.py`**: Delete ALL trails from Firestore (use with caution)
- **`check_firestore.py`**: View trails stored in Firestore

### Data Import

- **`import_foraging.py`**: Import foraging spots from CSV
- **`import_places.py`**: Import places/POIs

### Maintenance

- **`backfill_trail_metadata.py`**: Update existing trails with missing metadata
- **`check_foraging.py`**: Verify foraging data integrity
- **`check_rounding.py`**: Check coordinate precision

## Files

- **`secret_mappings.yaml`**: Maps Secret Manager secrets to environment variables
- **`setup_env.py`**: Main setup script for local environment
- **`update_skaneleden_trails.py`**: Downloads, merges, and simplifies Skåneleden GPX files
- **`README.md`**: This file
