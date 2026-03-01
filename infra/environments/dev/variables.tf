variable "project" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
}

variable "firestore_location" {
  description = "Firestore location ID (e.g., eur3 for multi-region Europe)"
  type        = string
}

variable "firestore_database_name" {
  description = "Firestore database name"
  type        = string
  default     = "skane-trails-db"
}

variable "hosting_site_id" {
  description = "Firebase Hosting site ID (must be globally unique, becomes <site-id>.web.app)"
  type        = string
}

variable "oauth_secrets_exist" {
  description = "Whether OAuth secrets exist in Secret Manager (set to true after running create-oauth-client script)"
  type        = bool
  default     = false
}

# GitHub repository info for Workload Identity Federation
variable "github_repository_owner" {
  description = "GitHub repository owner (organization or user)"
  type        = string
  default     = "SkaneTrails"
}

variable "github_repository" {
  description = "Full GitHub repository path (owner/repo)"
  type        = string
  default     = "SkaneTrails/skane-trails-checker"
}

variable "tfstate_bucket_name" {
  description = "GCS bucket name for Terraform state (must be globally unique)"
  type        = string
}

# Backup configuration
variable "backup_bucket_name" {
  description = "Name for the Cloud Storage bucket to store Firestore backups (must be globally unique)"
  type        = string
}

variable "backup_bucket_location" {
  description = "Location for the backup bucket (e.g., EU for multi-region Europe)"
  type        = string
  default     = "EU"
}

variable "backup_retention_days" {
  description = "Number of days to retain backups before auto-deletion (keep under 5GB for free tier)"
  type        = number
  default     = 30
}

variable "backup_schedule" {
  description = "Cron schedule for Firestore backups (default: nightly at 3 AM UTC)"
  type        = string
  default     = "0 3 * * *"
}
