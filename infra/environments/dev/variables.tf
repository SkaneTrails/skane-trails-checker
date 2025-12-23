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

# Commented out: unused variable flagged by TFLint
# variable "location" {
#   description = "GCP location for multi-regional resources (e.g., Cloud Storage)"
#   type        = string
# }
