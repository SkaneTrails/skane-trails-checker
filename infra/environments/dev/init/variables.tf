variable "project" {
  description = "GCP project ID for the Skåne Trails Checker application"
  type        = string
}

# Commented out: unused variable flagged by TFLint
# variable "region" {
#   description = "GCP region for regional resources"
#   type        = string
# }

variable "location" {
  description = "GCS bucket location (regional or multi-regional)"
  type        = string
}
