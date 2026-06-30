# Troubleshooting Guide

## API Won't Start

### "ModuleNotFoundError"

Dependencies not installed:

```bash
uv sync --extra dev
```

### "Could not find Firestore credentials"

The API needs Firestore connection details. Run the setup script:

```bash
gcloud auth application-default login
uv run python dev-tools/setup_env.py
```

This creates a `.env` file with Firestore secrets from GCP Secret Manager.

### "Permission denied" / "403 Forbidden" on Firestore

Your GCP credentials lack Firestore access. Check:

```bash
gcloud auth application-default print-access-token
gcloud projects get-iam-policy YOUR_PROJECT_ID
```

You need at least `roles/datastore.user` on the project.

### CORS Errors in Browser

The API defaults to allowing `localhost:3000,8080,8081,8082,19006`. If your frontend runs on a different port, set `ALLOWED_ORIGINS`:

```bash
# .env
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

## Mobile App Issues

### "Network request failed" / Can't reach API

1. Make sure the API is running on port 8000
1. Check `mobile/.env.development` has the correct `EXPO_PUBLIC_API_URL`
1. For Expo web, `http://localhost:8000` should work
1. For device testing, use your machine's LAN IP instead of `localhost`

### Authentication Not Working

Without Firebase credentials, the app runs in dev mode with a mock user. To enable real auth:

1. Copy `mobile/.env.example` to `mobile/.env.development`
1. Fill in Firebase config values from Firebase Console
1. Restart Expo

## Environment Setup

### `setup_env.py` Fails

**"gcloud not found":**

```powershell
# PowerShell
$env:PATH += ";$(Split-Path (Get-Command gcloud).Path)"
```

```bash
# Bash
export PATH="$PATH:$(dirname $(which gcloud))"
```

**"Secret not found":** The GCP project needs Secret Manager secrets configured. Follow the [infrastructure guide](../infra/environments/dev/README.md) first.

**Options:**

- `--force` — Refresh even if `.env` is recent
- `--check` — Validate existing `.env`
- `--list` — Show expected secret mappings

### Python Version Mismatch

The project requires Python 3.14+. Check your version:

```bash
python --version
```

## Tests

### Running Tests

```bash
# All API tests
uv run pytest

# With coverage
uv run pytest --cov=app --cov=api --cov-report=term-missing

# Mobile tests
cd mobile && pnpm test
```

### Clean Start

```bash
rm -rf .venv
uv sync --extra dev
uv run pytest
```

## Infrastructure / Terraform

See the [infrastructure troubleshooting section](../infra/environments/dev/README.md#troubleshooting) for Terraform-specific issues.

## Still Having Issues?

Open a GitHub issue with:

- The exact error message
- Output of `uv run pytest -v`
- Your Python version and OS
- Steps you've tried from this guide
