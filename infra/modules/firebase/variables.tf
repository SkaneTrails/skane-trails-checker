variable "project" {
  description = "GCP project ID"
  type        = string
}

variable "firestore_database" {
  description = "Firestore database name"
  type        = string
  default     = "skane-trails-db"
}

variable "hosting_site_id" {
  description = "Firebase Hosting site ID (must be globally unique, becomes <site-id>.web.app)"
  type        = string
}

variable "firebase_api_service" {
  description = "Firebase API service resource (for dependency)"
  type        = any
}

variable "identitytoolkit_api_service" {
  description = "Identity Toolkit API service resource (for dependency)"
  type        = any
}

variable "secretmanager_api_service" {
  description = "Secret Manager API service resource (for dependency)"
  type        = any
}

variable "firestore_ready" {
  description = "Firestore readiness signal (for dependency)"
  type        = any
}

variable "superusers" {
  description = "List of superuser email addresses with global app access"
  type        = list(string)
  default     = []
}

# OAuth secrets - created by scripts/create-oauth-client.sh
# Set to true after running the script
variable "oauth_secrets_exist" {
  description = "Whether OAuth secrets exist in Secret Manager (set to true after running create-oauth-client script)"
  type        = bool
  default     = false
}

variable "api_url" {
  description = "Cloud Run API URL (without trailing /api)"
  type        = string
  default     = ""
}

variable "github_actions_sa_email" {
  description = "GitHub Actions service account email for per-secret IAM bindings"
  type        = string
  default     = ""
}

# Android app (Google Sign-In on Google Play builds)
variable "android_package_name" {
  description = "Android application ID; must equal expo.android.package in mobile/app.json and the app in Google Play"
  type        = string
  default     = "com.skanetrails.hikes"
}

variable "android_sha1_hashes" {
  description = "SHA-1 fingerprints (lowercase hex, no colons) of the certificates the app is signed with: the Play app signing key, optionally the upload key"
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for h in var.android_sha1_hashes : can(regex("^[0-9a-f]{40}$", h))])
    error_message = "Each SHA-1 must be 40 lowercase hex characters without colons."
  }
}

variable "android_sha256_hashes" {
  description = "SHA-256 fingerprints (lowercase hex, no colons) matching android_sha1_hashes"
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for h in var.android_sha256_hashes : can(regex("^[0-9a-f]{64}$", h))])
    error_message = "Each SHA-256 must be 64 lowercase hex characters without colons."
  }
}
