variable "project" {
  description = "GCP project ID for the Skåne Trails Checker application"
  type        = string
}

variable "region" {
  description = "GCP region for regional resources"
  type        = string
  default     = "europe-west1"
}

variable "location" {
  description = "GCS bucket location (regional or multi-regional)"
  type        = string
}
