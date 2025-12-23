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

2. **IAM Permissions**: Your user must have `roles/secretmanager.secretAccessor` role

3. **Python Dependencies**: Install dev dependencies with:

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
2. **Secret Mapping**: Uses `secret_mappings.yaml` to map Secret Manager secret names to environment variable names
3. **Fetch from GCP**: Retrieves latest versions of secrets using Secret Manager API
4. **Write `.env`**: Creates/updates `.env` file with fetched values
5. **Freshness Check**: Skips fetching if `.env` is less than 24 hours old (override with `--force`)

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

2. Missing permissions:

   ```bash
   # Check your IAM roles
   gcloud projects get-iam-policy YOUR_PROJECT_ID --flatten="bindings[].members" --filter="bindings.members:user:YOUR_EMAIL"
   ```

3. Secret Manager API not enabled:

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
2. Add mapping to `secret_mappings.yaml`
3. Run `uv run python dev-tools/setup_env.py --force`

#### Security Notes

- `.env` files are **gitignored** - never commit them
- File permissions are set to 600 (owner-only read/write)
- Secrets are fetched on-demand, not stored in code
- Use Secret Manager as the single source of truth for configuration

## Files

- **`secret_mappings.yaml`**: Maps Secret Manager secrets to environment variables
- **`setup_env.py`**: Main setup script (documented above)
- **`README.md`**: This file
