variable "project" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
}

variable "location" {
  description = "GCP location for multi-regional resources (e.g., Cloud Storage)"
  type        = string
}

variable "users" {
  description = "List of user emails to grant project access"
  type        = list(string)
}
