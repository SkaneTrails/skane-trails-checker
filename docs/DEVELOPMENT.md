# Development Guide

Local setup, environment configuration, and API reference for developers.

> **For contribution guidelines**, see [CONTRIBUTING.md](../CONTRIBUTING.md)
> **For infrastructure setup**, see [infra/environments/dev/README.md](../infra/environments/dev/README.md)

## Quick Reference

```bash
# API server
uv run uvicorn api.main:app --reload --reload-dir api --port 8000

# Mobile / web
cd mobile && npx expo start --web

# Tests
uv run pytest --cov=app --cov=api --cov-report=term-missing

# Lint / format
uv run ruff check --fix && uv run ruff format
```

## Setup

### Prerequisites

- Python 3.14+
- [UV package manager](https://github.com/astral-sh/uv)
- Node.js 20+ and [pnpm](https://pnpm.io/) (for mobile/web app)

### Installation

```bash
git clone https://github.com/SkaneTrails/skane-trails-checker.git
cd skane-trails-checker

# API dependencies
uv sync --extra dev
uv run pre-commit install

# Mobile dependencies
cd mobile
pnpm install
```

## Environment Setup

### API Environment Variables

First-time setup requires Firestore connection configuration:

1. **Authenticate with Google Cloud:**

   ```bash
   gcloud auth application-default login
   ```

1. **Fetch Firestore secrets from GCP Secret Manager:**

   ```bash
   uv run python dev-tools/setup_env.py
   ```

   This creates a `.env` file with Firestore connection details (gitignored). The script checks freshness (24h) and skips if the file is recent.

   **Options:**

   - `--force` — Force refresh even if `.env` is fresh
   - `--check` — Validate `.env` has all required variables
   - `--list` — Show secret mappings

The API requires these environment variables (set automatically by `setup_env.py`):

| Variable                | Required | Description                                                |
| ----------------------- | -------- | ---------------------------------------------------------- |
| `FIRESTORE_PROJECT_ID`  | Yes      | GCP project ID                                             |
| `FIRESTORE_DATABASE_ID` | Yes      | Firestore database name (default: `skane-trails-db`)       |
| `FIRESTORE_LOCATION_ID` | Yes      | Firestore region (e.g., `eur3`)                            |
| `ALLOWED_ORIGINS`       | No       | Comma-separated CORS origins (defaults to localhost ports) |
| `SKIP_AUTH`             | No       | Set to `true` to skip Firebase auth (local dev)            |

### Mobile Environment Variables

```bash
cd mobile
cp .env.example .env.development
```

Without Firebase/OAuth values, the app runs in dev mode with a mock user.

| Variable                         | Required | Description                                |
| -------------------------------- | -------- | ------------------------------------------ |
| `EXPO_PUBLIC_API_URL`            | Yes      | API URL (default: `http://localhost:8000`) |
| `EXPO_PUBLIC_FIREBASE_*`         | No\*     | Firebase config for authentication         |
| `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` | No\*     | OAuth client IDs for Google Sign-In        |

**\*Authentication in dev mode:** If Firebase/OAuth credentials are not configured, the app runs in "dev mode" with a mock authenticated user. This allows local development without setting up Firebase.

## Running the Application

### FastAPI Backend

```bash
uv run uvicorn api.main:app --reload --reload-dir api --port 8000
```

API docs available at `http://localhost:8000/api/docs` (Swagger) and `http://localhost:8000/api/redoc` (ReDoc).

### Mobile / Web App

```bash
cd mobile
npx expo start --web
```

## Project Structure

```
skane-trails-checker/
├── api/                       # FastAPI REST backend
│   ├── main.py                # App entry point, CORS, security headers
│   ├── auth/                  # Firebase Auth middleware
│   ├── models/                # Pydantic models (Trail, Foraging, Place)
│   ├── routers/               # REST endpoints (trails, foraging, places)
│   ├── services/              # Business logic (GPX parsing)
│   └── storage/               # Firestore persistence
├── app/                       # Server-side GPX processing
│   ├── functions/             # GPX parsing, trail conversion, bootstrap
│   ├── resources/             # Static data
│   └── tracks_gpx/            # Bundled Skåneleden GPX files
├── mobile/                    # Expo / React Native app
│   ├── app/                   # Expo Router screens (tabs, trail detail, upload)
│   ├── components/            # Shared UI (Button, TrailCard, TrailMap, etc.)
│   └── lib/                   # API client, hooks, theme, types, storage
├── dev-tools/                 # Admin scripts (setup, import, backfill)
├── infra/                     # Terraform infrastructure
│   ├── environments/dev/      # Dev environment config + setup guide
│   └── modules/               # 8 reusable modules
├── tests/                     # pytest test suite
└── docs/                      # This guide + troubleshooting
```

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Trails

| Method   | Path                   | Auth | Description                                      |
| -------- | ---------------------- | ---- | ------------------------------------------------ |
| `GET`    | `/trails/sync`         | No   | Sync metadata (count, last_modified)             |
| `GET`    | `/trails`              | No   | List trails (filter by source, status, distance) |
| `GET`    | `/trails/{id}`         | No   | Get single trail                                 |
| `GET`    | `/trails/{id}/details` | No   | Full trail data (all coordinates)                |
| `PATCH`  | `/trails/{id}`         | Yes  | Update trail                                     |
| `DELETE` | `/trails/{id}`         | Yes  | Delete trail                                     |
| `POST`   | `/trails/upload`       | Yes  | Upload GPX file                                  |

### Foraging

| Method   | Path                     | Auth | Description                  |
| -------- | ------------------------ | ---- | ---------------------------- |
| `GET`    | `/foraging/spots`        | No   | List spots (filter by month) |
| `POST`   | `/foraging/spots`        | Yes  | Create spot                  |
| `PATCH`  | `/foraging/spots/{id}`   | Yes  | Update spot                  |
| `DELETE` | `/foraging/spots/{id}`   | Yes  | Delete spot                  |
| `GET`    | `/foraging/types`        | No   | List foraging types          |
| `POST`   | `/foraging/types`        | Yes  | Create/update type           |
| `DELETE` | `/foraging/types/{name}` | Yes  | Delete type                  |

### Places

| Method | Path                 | Auth | Description                      |
| ------ | -------------------- | ---- | -------------------------------- |
| `GET`  | `/places`            | No   | List places (filter by category) |
| `GET`  | `/places/categories` | No   | List place categories            |

### Other

| Method | Path      | Auth | Description  |
| ------ | --------- | ---- | ------------ |
| `GET`  | `/health` | No   | Health check |

## Seeding Trail Data

After deploying infrastructure, Firestore is empty. There are two ways to add trails:

### Skåneleden Trails (Bootstrap)

The repo includes a bundled GPX file with all 169 Skåneleden etapps at `app/tracks_gpx/planned_hikes/all-skane-trails.gpx`. To seed them into Firestore:

```bash
uv run python -c "from app.functions.bootstrap_trails import bootstrap_planned_trails; bootstrap_planned_trails('app/tracks_gpx/planned_hikes/all-skane-trails.gpx')"
```

This is idempotent — it skips if `planned_hikes` trails already exist in Firestore.

To refresh the bundled GPX file from the official Skåneleden website:

```bash
uv run python dev-tools/update_skaneleden_trails.py
```

Then re-bootstrap after clearing old data:

```bash
uv run python dev-tools/delete_planned_trails.py
```

### Custom Trails (GPX Upload)

Upload GPX files through the app's upload screen, or via the API:

```bash
curl -X POST http://localhost:8000/api/v1/trails/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@my-trail.gpx" \
  -F "source=other_trails"
```

### Bulk GPX Import (CLI)

Import GPX files directly into Firestore using the database manager:

```bash
# Import all GPX files from a directory
uv run python dev-tools/db_manager.py trails import --gpx-dir path/to/gpx/ --source other_trails

# Preview first
uv run python dev-tools/db_manager.py trails import --gpx-dir path/to/gpx/ --dry-run
```

Includes duplicate detection (by date ±60min, then name). See [dev-tools/README.md](../dev-tools/README.md) for full options.

### Database Management

The `db_manager.py` tool provides interactive and CLI access to all Firestore collections:

```bash
# Interactive menu
uv run python dev-tools/db_manager.py

# Search trails
uv run python dev-tools/db_manager.py trails search "söderåsen"

# View full trail details
uv run python dev-tools/db_manager.py trails get <trail_id>

# Collection overview
uv run python dev-tools/db_manager.py status
```

See [dev-tools/README.md](../dev-tools/README.md) for the complete command reference.

## Authentication

The API uses Firebase Auth with Google Sign-In:

1. Mobile signs in via Firebase (Google OAuth)
1. Gets ID token from Firebase SDK
1. Sends token in `Authorization: Bearer <token>` header
1. API validates token with Firebase Admin SDK
1. Write endpoints return 401 if token is invalid/expired

For local development, set `SKIP_AUTH=true` to bypass authentication.

## Testing

### API (pytest)

```bash
# All tests
uv run pytest

# With coverage
uv run pytest --cov=app --cov=api --cov-report=term-missing

# Specific file
uv run pytest tests/test_api_trails.py -v
```

Coverage threshold: 85% (enforced by `fail_under` in `pyproject.toml`).

### Mobile (Vitest)

```bash
cd mobile
pnpm test
pnpm test:coverage
```

## Linting and Formatting

```bash
# Python
uv run ruff check --fix
uv run ruff format

# All pre-commit hooks
uv run pre-commit run --all-files
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.

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
