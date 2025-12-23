variable "project" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
}

# Commented out: unused variable flagged by TFLint
# variable "location" {
#   description = "GCP location for multi-regional resources (e.g., Cloud Storage)"
#   type        = string
# }

variable "users" {
  description = "List of user email addresses to grant access to"
  type        = list(string)
}
