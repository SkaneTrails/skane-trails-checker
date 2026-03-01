# Development Environment — Setup Guide

This guide walks you through setting up the entire Skåne Trails Checker infrastructure from scratch.

**Audience**: Someone who just cloned the repo and created a Google Cloud project. No prior Terraform or GCP experience required.

## Prerequisites

Install these tools before starting:

| Tool                                                                   | Install                                              | Verify               |
| ---------------------------------------------------------------------- | ---------------------------------------------------- | -------------------- |
| [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.12 | `choco install terraform` / `brew install terraform` | `terraform -version` |
| [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)          | See link                                             | `gcloud --version`   |
| [GitHub CLI](https://cli.github.com/)                                  | `choco install gh` / `brew install gh`               | `gh --version`       |

## Step 1: Authenticate

```bash
gcloud auth login
gcloud auth application-default login
gh auth login
```

## Step 2: Enable the Service Usage API

Terraform manages all other APIs, but it needs this one enabled first (chicken-and-egg).

```bash
gcloud services enable serviceusage.googleapis.com --project=YOUR_PROJECT_ID
```

## Step 3: Bootstrap the Terraform state bucket

This creates a GCS bucket that Terraform uses to store its state remotely.

```bash
cd infra/environments/dev/init/
terraform init
terraform apply
cd ..
```

This generates three files in the `dev/` directory:

- `backend.tf` — tells Terraform where to store state
- `tfstate.auto.tfvars` — the bucket name (used by `state.tf`)
- `import_tfstate_bucket.sh` / `.ps1` — import script (next step)

## Step 4: Import the state bucket

```bash
# macOS/Linux
./import_tfstate_bucket.sh

# Windows (PowerShell)
.\import_tfstate_bucket.ps1
```

## Step 5: Configure variables

Copy the example file and fill in your values:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` — every required value has a comment explaining what it is. See the [Variables](#variables) table below.

## Step 6: Add superusers

Create the superusers file with your email (one email per line):

```bash
mkdir -p access
echo "your-email@example.com" > access/superusers.txt
```

Superusers get GCP IAM access and app-level admin privileges. Regular users are managed in-app later.

## Step 7: Apply infrastructure

```bash
terraform init
terraform plan    # Review what will be created
terraform apply   # Create everything
```

**First apply**: Cloud Run deploys with a placeholder image (Google's hello container). This is expected — your real image doesn't exist yet.

## Step 8: Sync secrets to GitHub

The CI/CD workflows need repository secrets. The setup script reads your local files and pushes them:

```bash
# macOS/Linux
./scripts/sync-secrets.sh

# Windows (PowerShell)
.\scripts\sync-secrets.ps1
```

This creates 7 GitHub secrets: `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`, `GCP_REGION`, `TF_BACKEND_BUCKET`, `TF_BACKEND_PREFIX`, `TF_VARS_FILE`, `TF_SUPERUSERS`.

**Re-run this script** whenever you change `terraform.tfvars`, `backend.tf`, or `access/superusers.txt`.

## Step 9: Push and deploy

Push to `main` to trigger the first CI/CD build. This builds and pushes the real Docker image to Artifact Registry.

After the first successful CI build:

1. Uncomment the `image_url` line in `main.tf` (the one pointing to Artifact Registry)
1. Run `terraform apply` again — Cloud Run now uses your real image
1. Re-run the sync-secrets script if tfvars changed

## Step 10 (optional): Enable OAuth / Google Sign-In

1. Go to the [GCP Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)

1. Click **Create Credentials → OAuth client ID**

1. Choose **Web application**, set the name to `skane-trails`

1. Add authorized redirect URIs (get the Cloud Run URL first: `terraform output cloud_run_url`)

1. Copy the **Client ID** and **Client Secret**

1. Store them in Secret Manager:

   ```bash
   echo -n "YOUR_CLIENT_ID" | gcloud secrets versions add skane-trails_oauth_client_id --data-file=-
   echo -n "YOUR_CLIENT_SECRET" | gcloud secrets versions add skane-trails_oauth_client_secret --data-file=-
   ```

1. Add to `terraform.tfvars`:

   ```hcl
   oauth_secrets_exist = true
   ```

1. Re-apply: `terraform apply`

______________________________________________________________________

## Directory Structure

```text
dev/
├── init/              # Bootstrap (state bucket, one-time)
├── access/            # Superuser emails (gitignored)
│   └── superusers.txt
├── scripts/           # Setup and sync scripts
│   └── sync-secrets.sh / .ps1
├── main.tf            # All module wiring
├── variables.tf       # Variable definitions
├── terraform.tfvars   # Your values (gitignored)
├── terraform.tfvars.example  # Template to copy
├── backend.tf         # Generated by bootstrap (gitignored)
├── backend.tf.example # Template reference
├── state.tf           # State bucket resource
├── outputs.tf         # Useful outputs
└── versions.tf        # Provider versions
```

## Modules Used

| Module                  | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| **apis**                | Enables required GCP APIs (Firestore, IAM, Cloud Run, Firebase, etc.) |
| **iam**                 | Service accounts, custom roles, user access bindings                  |
| **firestore**           | Firestore Native database + Secret Manager secrets                    |
| **artifact_registry**   | Docker image repository for Cloud Run                                 |
| **cloud_run**           | FastAPI backend (scale-to-zero, health probes)                        |
| **firebase**            | Firebase Web App, Auth, Hosting, superuser docs, CI/CD secrets        |
| **workload_federation** | Keyless GitHub Actions → GCP auth via OIDC                            |
| **backup**              | Scheduled Firestore exports to Cloud Storage                          |

## Variables

| Name                      | Description                                       | Default                            | Required |
| ------------------------- | ------------------------------------------------- | ---------------------------------- | -------- |
| `project`                 | GCP project ID                                    | —                                  | Yes      |
| `region`                  | GCP region                                        | —                                  | Yes      |
| `firestore_location`      | Firestore location (e.g., `eur3`)                 | —                                  | Yes      |
| `firestore_database_name` | Firestore database name                           | `skane-trails-db`                  | No       |
| `hosting_site_id`         | Firebase Hosting site ID (becomes `<id>.web.app`) | —                                  | Yes      |
| `tfstate_bucket_name`     | State bucket name (from bootstrap)                | —                                  | Yes      |
| `backup_bucket_name`      | Backup bucket name (globally unique)              | —                                  | Yes      |
| `backup_bucket_location`  | Backup bucket location                            | `EU`                               | No       |
| `backup_retention_days`   | Days to keep backups                              | `30`                               | No       |
| `backup_schedule`         | Cron schedule for backups                         | `0 3 * * *`                        | No       |
| `oauth_secrets_exist`     | Set `true` after running OAuth script             | `false`                            | No       |
| `github_repository_owner` | GitHub org/user                                   | `SkaneTrails`                      | No       |
| `github_repository`       | Full repo path                                    | `SkaneTrails/skane-trails-checker` | No       |

## Free Tier Compliance

All resources stay within GCP free tier limits:

| Resource            | Free Tier Limit              | Our Usage                                      |
| ------------------- | ---------------------------- | ---------------------------------------------- |
| Cloud Run           | 2M requests, 360K GB-s/month | Minimal (personal app)                         |
| Firestore           | 1 GB, 50K reads/day          | < 100 MB                                       |
| Cloud Storage       | 5 GB                         | < 1 MB (state + backups)                       |
| Secret Manager      | 6 active versions            | ~10 versions (exceeds free tier, minimal cost) |
| Artifact Registry   | 500 MB                       | ~200 MB (Docker images)                        |
| API enablement, IAM | No cost                      | —                                              |

## Troubleshooting

### "Error: project does not exist"

Check that your `project` in `terraform.tfvars` matches a real GCP project (`gcloud projects list`).

### "Error: insufficient permissions"

Your Google account needs Project Owner or Editor. Check:

```bash
gcloud projects get-iam-policy YOUR_PROJECT_ID
```

### "tainted" resources

A previous apply partially failed. Remove the taint:

```bash
terraform untaint MODULE.RESOURCE_NAME
```

### Secret Manager "payload required"

A dependency (e.g., Cloud Run URL) was empty. Re-run `terraform apply` — the `coalesce()` fallback handles this.

### Secrets out of sync with GitHub

Re-run the sync script whenever local files change:

```bash
./scripts/sync-secrets.sh    # or .ps1
```
