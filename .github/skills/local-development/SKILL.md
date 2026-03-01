______________________________________________________________________

## name: local-development description: GCP secrets, .env setup, starting servers, and troubleshooting local development

# Local Development Setup

Get the Skåne Trails Checker app running locally with minimal manual work.

## Prerequisites

- **gcloud CLI** — authenticated with project access
- **UV** — Python package manager (`pip install uv`)
- **Node.js** + **pnpm** — for mobile app (`npm install -g pnpm`)

## GCP Project ID

Read from the root `.env` file: `GOOGLE_CLOUD_PROJECT=<project-id>`. This file is gitignored but present on all developer machines.

**NEVER fabricate a project ID.** If `.env` is missing, ask the user.

______________________________________________________________________

## Step 1: GCP Authentication

Standard ADC via `gcloud auth application-default login` is the default auth method. If you encounter `CONSUMER_INVALID` errors, service account impersonation may be required.

### Automated (recommended)

```bash
uv run python dev-tools/setup_env.py
```

The script reads `dev-tools/secret_mappings.yaml` and populates `.env` from GCP Secret Manager.

### Manual (if script fails)

```bash
gcloud auth application-default login \
  --impersonate-service-account=st-local-dev@<PROJECT_ID>.iam.gserviceaccount.com
```

Tokens expire after 1 hour — re-run to refresh.

______________________________________________________________________

## Step 2: Environment Files

### Root `.env`

Required variables:

```
GOOGLE_CLOUD_PROJECT=<project-id>
FIRESTORE_PROJECT_ID=<project-id>
FIRESTORE_DATABASE_ID=skane-trails-db
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:3000
```

### How the app detects production

`app/functions/env_loader.py` checks for `FIRESTORE_DATABASE_ID` or `FIRESTORE_DATABASE`. If neither is set, it loads `.env` from the project root (development mode).

______________________________________________________________________

## Step 3: Start Services

### Streamlit App

```bash
uv sync
uv run streamlit run app/_Home_.py
```

Must run from project root. Streamlit auto-discovers pages in `app/pages/`.

### FastAPI Backend

```bash
uv run uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

### Mobile App

```bash
cd mobile
pnpm install
npx expo start --web --port 8081
```

**Before starting, check if services are already running** — avoid duplicate listeners:

```powershell
netstat -ano | findstr :8000   # API
netstat -ano | findstr :8081   # Expo
```

______________________________________________________________________

## Step 4: Verify Setup

### Tests

```bash
uv run pytest                                     # All tests
uv run pytest --cov=app --cov=api --cov-report=term-missing  # With coverage
uv run pytest tests/test_firestore_client.py -v   # Single file
```

### Linting

```bash
uv run ruff check      # Python lint
uv run ruff format     # Python format
```

______________________________________________________________________

## Dev Tools

The `dev-tools/` directory contains maintenance scripts:

| Script                        | Purpose                                 |
| ----------------------------- | --------------------------------------- |
| `setup_env.py`                | Populate `.env` from GCP Secret Manager |
| `check_firestore.py`          | Inspect Firestore data                  |
| `check_foraging.py`           | Verify foraging data                    |
| `import_foraging.py`          | Import foraging data                    |
| `import_places.py`            | Import Skåneleden places/POIs           |
| `update_skaneleden_trails.py` | Update trail data from Skåneleden       |
| `backfill_trail_metadata.py`  | Backfill missing trail metadata         |
| `delete_all_trails.py`        | Delete all trails (destructive!)        |
| `delete_planned_trails.py`    | Delete planned trails only              |

**Always check `dev-tools/` before writing ad-hoc scripts.**

______________________________________________________________________

## Troubleshooting

| Problem                         | Fix                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `CONSUMER_INVALID` on Firestore | ADC not using impersonation — re-run setup                                       |
| "Permission denied" on secrets  | `gcloud auth login` + `gcloud config set project <id>`                           |
| `.env` not loading              | Check `env_loader.py` — needs `FIRESTORE_DATABASE_ID` unset for dev mode         |
| Impersonation token expired     | Re-run `gcloud auth application-default login --impersonate-service-account=...` |
| Port already in use             | `netstat -ano \| findstr :8000` then `taskkill /PID <pid> /F` (Windows)          |
| Streamlit pages not showing     | Must run from project root, pages auto-discovered from `app/pages/`              |
