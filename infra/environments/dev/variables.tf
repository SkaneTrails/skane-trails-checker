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
  description = "Cron schedule for Firestore backups (default: Sundays at 3 AM UTC)"
  type        = string
  default     = "0 3 * * 0"
}

variable "firestore_database_names" {
  description = "List of Firestore database names to backup"
  type        = list(string)
}
