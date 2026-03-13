# Skåne Trails Checker Infrastructure - Development Environment
#
# Backend configuration is in backend.tf
# Version requirements in versions.tf
# Terraform state bucket in state.tf
#
# Setup:
# 1. Copy terraform.tfvars.example to terraform.tfvars and fill in values
# 2. Create access/superusers.txt with superuser emails (one per line)
# 3. Run: terraform init && terraform apply

provider "google" {
  project = var.project
  region  = var.region

  user_project_override = true
  billing_project       = var.project
}

provider "google-beta" {
  project = var.project
  region  = var.region

  user_project_override = true
  billing_project       = var.project
}

# Read superusers from access/superusers.txt (gitignored)
# Superusers have GCP IAM access and app-level admin privileges
# Regular users are managed in-app by superusers (no IAM needed)
locals {
  superusers_file_content = fileexists("${path.module}/access/superusers.txt") ? file("${path.module}/access/superusers.txt") : ""
  superusers_lines        = split("\n", trimspace(local.superusers_file_content))
  superusers = compact([
    for line in local.superusers_lines :
    trimspace(line)
    if trimspace(line) != "" && !startswith(trimspace(line), "#")
  ])
}

# Enable required APIs first
module "apis" {
  source = "../../modules/apis"

  project = var.project
}

# IAM module - Grant permissions to users and service accounts
# Custom roles are defined within this module (custom_roles.tf)
module "iam" {
  source = "../../modules/iam"

  project             = var.project
  superusers          = local.superusers
  tfstate_bucket_name = var.tfstate_bucket_name
  backup_bucket_name  = var.backup_bucket_name

  # Implicit dependency on APIs module through output reference
  iam_api_service = module.apis.iam_service
}

# Firestore database - Store track statuses and foraging data
# Implicit dependencies: references module.apis outputs and module.iam
module "firestore" {
  source = "../../modules/firestore"

  project       = var.project
  database_name = var.firestore_database_name
  location_id   = var.firestore_location

  # Implicit dependencies through API service references
  firestore_api_service     = module.apis.firestore_service
  secretmanager_api_service = module.apis.secretmanager_service
  firebaserules_api_service = module.apis.firebaserules_service

  # Ensure IAM permissions are in place before creating Firestore resources
  iam_bindings_complete = module.iam.iam_bindings_complete
}

# Artifact Registry - Store container images for Cloud Run
module "artifact_registry" {
  source = "../../modules/artifact_registry"

  project         = var.project
  region          = var.region
  repository_name = "skane-trails"

  artifactregistry_api_service = module.apis.artifactregistry_service
}

# Cloud Run - API service
module "cloud_run" {
  source = "../../modules/cloud_run"

  project            = var.project
  region             = var.region
  service_name       = "skane-trails-api"
  image_url          = "${module.artifact_registry.repository_url}/skane-trails-api:${var.image_tag}"
  firestore_database = var.firestore_database_name
  allowed_origins = join(",", [
    module.firebase.hosting_url,
    "http://localhost:8501",
    "http://localhost:8000",
  ])

  # Allow public access - Firebase Auth is validated in application code
  allow_public_access = true

  run_api_service = module.apis.run_service
}

# Firebase - Authentication and Hosting
module "firebase" {
  source = "../../modules/firebase"

  project            = var.project
  firestore_database = var.firestore_database_name
  hosting_site_id    = var.hosting_site_id

  # Superusers with global app access (from access/superusers.txt)
  superusers = local.superusers

  # OAuth credentials are read from Secret Manager
  # Set to true after running: ./scripts/create-oauth-client.sh
  oauth_secrets_exist = var.oauth_secrets_exist

  # API URL for GitHub Actions secrets (stored in Secret Manager)
  api_url = module.cloud_run.service_url

  # GitHub Actions SA for per-secret IAM bindings (least privilege)
  github_actions_sa_email = module.iam.github_actions_firebase_email

  firebase_api_service        = module.apis.firebase_service
  identitytoolkit_api_service = module.apis.identitytoolkit_service
  secretmanager_api_service   = module.apis.secretmanager_service
  firestore_ready             = module.firestore.database
}

# Firestore backup - Scheduled exports to Cloud Storage
# Free tier: Cloud Scheduler (3 jobs), Cloud Storage (5 GB), Cloud Functions (2M invocations)
module "backup" {
  source = "../../modules/backup"

  project                  = var.project
  backup_bucket_name       = var.backup_bucket_name
  backup_bucket_location   = var.backup_bucket_location
  backup_retention_days    = var.backup_retention_days
  backup_schedule          = var.backup_schedule
  firestore_database_names = module.firestore.database_names
  function_region          = var.region
  scheduler_region         = var.region

  # API dependencies
  storage_api_service        = module.apis.storage_service
  cloudfunctions_api_service = module.apis.cloudfunctions_service
  cloudbuild_api_service     = module.apis.cloudbuild_service
  cloudscheduler_api_service = module.apis.cloudscheduler_service
  run_api_service            = module.apis.run_service
}

# -----------------------------------------------------------------------------
# Service Account User grants (scoped to specific runtime SAs, not project-level)
# CD only — when splitting SAs, assign to CD SA only.
# -----------------------------------------------------------------------------

# Cloud Run deploy SA needs to attach the Cloud Run runtime SA during deployment
resource "google_service_account_iam_member" "cloudrun_sa_user_on_api" {
  service_account_id = "projects/${var.project}/serviceAccounts/${module.cloud_run.service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${module.iam.github_actions_cloudrun_email}"
}

# Terraform SA needs to attach runtime SAs when applying Cloud Run configs
resource "google_service_account_iam_member" "terraform_sa_user_on_api" {
  service_account_id = "projects/${var.project}/serviceAccounts/${module.cloud_run.service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${module.iam.github_actions_terraform_email}"
}

# Workload Identity Federation - Keyless auth from GitHub Actions
module "workload_federation" {
  source = "../../modules/workload_federation"

  project                 = var.project
  github_repository_owner = var.github_repository_owner
  github_repository       = var.github_repository
  service_account_ids = {
    firebase  = module.iam.github_actions_firebase_service_account.id
    cloudrun  = module.iam.github_actions_cloudrun_service_account.id
    terraform = module.iam.github_actions_terraform_service_account.id
  }
}
