# Firebase Project, Authentication, and Hosting for Skåne Trails
#
# Enables Firebase for the GCP project and configures:
# - Firebase Web App (generates API key and config)
# - Identity Platform with Google Sign-In
# - Firebase Hosting (multi-site: separate from meal-planner)
# - Superuser documents in Firestore
# - GitHub Actions secrets for CI/CD
#
# Setup order:
# 1. Run Terraform once to create Firebase project and Secret Manager
# 2. Run scripts/create-oauth-client.sh to create OAuth client
# 3. Set oauth_secrets_exist = true and run Terraform again

# NOTE: Firebase project (google_firebase_project) is already enabled by
# the meal-planner repo in the same GCP project. We skip creating it here
# to avoid conflicts. The firebase API enablement is sufficient.

# Create Firebase Web App - generates API key and config values
resource "google_firebase_web_app" "mobile" {
  provider     = google-beta
  project      = var.project
  display_name = "Skåne Trails"

  # Allow Terraform to delete the app if needed
  deletion_policy = "DELETE"

  depends_on = [var.firebase_api_service]
}

# Get the Firebase Web App config (API key, auth domain, etc.)
data "google_firebase_web_app_config" "mobile" {
  provider   = google-beta
  project    = var.project
  web_app_id = google_firebase_web_app.mobile.app_id
}

# Read OAuth credentials from Secret Manager (created by create-oauth-client script)
data "google_secret_manager_secret_version" "oauth_client_id" {
  count = var.oauth_secrets_exist ? 1 : 0

  project = var.project
  secret  = "skane-trails_oauth_client_id"

  depends_on = [
    var.secretmanager_api_service,
    google_secret_manager_secret.oauth_client_id,
  ]
}

data "google_secret_manager_secret_version" "oauth_client_secret" {
  count = var.oauth_secrets_exist ? 1 : 0

  project = var.project
  secret  = "skane-trails_oauth_client_secret"

  depends_on = [
    var.secretmanager_api_service,
    google_secret_manager_secret.oauth_client_secret,
  ]
}

# Secret Manager placeholders - import existing secrets or create empty ones
resource "google_secret_manager_secret" "oauth_client_id" {
  project   = var.project
  secret_id = "skane-trails_oauth_client_id"

  replication {
    auto {}
  }

  depends_on = [var.secretmanager_api_service]
}

resource "google_secret_manager_secret" "oauth_client_secret" {
  project   = var.project
  secret_id = "skane-trails_oauth_client_secret"

  replication {
    auto {}
  }

  depends_on = [var.secretmanager_api_service]
}

locals {
  oauth_client_id     = var.oauth_secrets_exist ? data.google_secret_manager_secret_version.oauth_client_id[0].secret_data : ""
  oauth_client_secret = var.oauth_secrets_exist ? data.google_secret_manager_secret_version.oauth_client_secret[0].secret_data : ""
}

# Configure Google Sign-In as identity provider
# Only created after OAuth secrets exist in Secret Manager
resource "google_identity_platform_default_supported_idp_config" "google" {
  count = var.oauth_secrets_exist ? 1 : 0

  provider = google-beta
  project  = var.project

  enabled       = true
  idp_id        = "google.com"
  client_id     = local.oauth_client_id
  client_secret = local.oauth_client_secret

  depends_on = [var.identitytoolkit_api_service]
}

# Create Firestore documents for superusers (global admin access)
# Superusers are defined in environments/dev/access/superusers.txt
resource "google_firestore_document" "superuser" {
  for_each = toset(var.superusers)

  project     = var.project
  database    = var.firestore_database
  collection  = "superusers"
  document_id = each.value # Email as document ID for O(1) lookup

  fields = jsonencode({
    added_by = {
      stringValue = "terraform"
    }
  })

  depends_on = [var.firestore_ready]
}

# Firebase Hosting - multi-site (separate from meal-planner)
resource "google_firebase_hosting_site" "default" {
  provider = google-beta
  project  = var.project
  site_id  = var.hosting_site_id

  depends_on = [var.firebase_api_service]
}

# =============================================================================
# GitHub Actions Secrets in Secret Manager
# These secrets are used by the firebase-hosting.yml workflow
# =============================================================================

resource "google_secret_manager_secret" "github_expo_public_api_url" {
  project   = var.project
  secret_id = "st_github_EXPO_PUBLIC_API_URL"

  replication {
    auto {}
  }

  depends_on = [var.secretmanager_api_service]
}

resource "google_secret_manager_secret_version" "github_expo_public_api_url" {
  secret      = google_secret_manager_secret.github_expo_public_api_url.id
  secret_data = var.api_url != "" ? var.api_url : "PLACEHOLDER_UNTIL_CLOUD_RUN_DEPLOYS"
}

resource "google_secret_manager_secret" "github_expo_public_firebase_api_key" {
  project   = var.project
  secret_id = "st_github_EXPO_PUBLIC_FIREBASE_API_KEY"

  replication {
    auto {}
  }

  depends_on = [var.secretmanager_api_service]
}

resource "google_secret_manager_secret_version" "github_expo_public_firebase_api_key" {
  secret      = google_secret_manager_secret.github_expo_public_firebase_api_key.id
  secret_data = data.google_firebase_web_app_config.mobile.api_key
}

resource "google_secret_manager_secret" "github_expo_public_firebase_app_id" {
  project   = var.project
  secret_id = "st_github_EXPO_PUBLIC_FIREBASE_APP_ID"

  replication {
    auto {}
  }

  depends_on = [var.secretmanager_api_service]
}

resource "google_secret_manager_secret_version" "github_expo_public_firebase_app_id" {
  secret      = google_secret_manager_secret.github_expo_public_firebase_app_id.id
  secret_data = google_firebase_web_app.mobile.app_id
}

resource "google_secret_manager_secret" "github_expo_public_firebase_messaging_sender_id" {
  project   = var.project
  secret_id = "st_github_EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"

  replication {
    auto {}
  }

  depends_on = [var.secretmanager_api_service]
}

resource "google_secret_manager_secret_version" "github_expo_public_firebase_messaging_sender_id" {
  secret      = google_secret_manager_secret.github_expo_public_firebase_messaging_sender_id.id
  secret_data = data.google_firebase_web_app_config.mobile.messaging_sender_id
}

# =============================================================================
# Per-secret IAM bindings for GitHub Actions (least privilege)
# =============================================================================

resource "google_secret_manager_secret_iam_member" "github_actions_api_url" {
  count = var.github_actions_sa_email != "" ? 1 : 0

  project   = var.project
  secret_id = google_secret_manager_secret.github_expo_public_api_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.github_actions_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "github_actions_firebase_api_key" {
  count = var.github_actions_sa_email != "" ? 1 : 0

  project   = var.project
  secret_id = google_secret_manager_secret.github_expo_public_firebase_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.github_actions_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "github_actions_firebase_app_id" {
  count = var.github_actions_sa_email != "" ? 1 : 0

  project   = var.project
  secret_id = google_secret_manager_secret.github_expo_public_firebase_app_id.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.github_actions_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "github_actions_firebase_messaging_sender_id" {
  count = var.github_actions_sa_email != "" ? 1 : 0

  project   = var.project
  secret_id = google_secret_manager_secret.github_expo_public_firebase_messaging_sender_id.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.github_actions_sa_email}"
}

resource "google_secret_manager_secret_iam_member" "github_actions_oauth_client_id" {
  count = var.github_actions_sa_email != "" ? 1 : 0

  project   = var.project
  secret_id = google_secret_manager_secret.oauth_client_id.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.github_actions_sa_email}"
}
