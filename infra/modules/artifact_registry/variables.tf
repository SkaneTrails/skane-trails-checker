variable "project" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for the repository"
  type        = string
}

variable "repository_name" {
  description = "Name of the Artifact Registry repository"
  type        = string
  default     = "skane-trails"
}

variable "artifactregistry_api_service" {
  description = "Artifact Registry API service resource (for dependency)"
  type        = any
}

variable "labels" {
  description = "Labels to apply to resources for billing and organization"
  type        = map(string)
  default     = {}
}
