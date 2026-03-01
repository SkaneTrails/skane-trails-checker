variable "project" {
  description = "GCP project ID"
  type        = string
}

variable "database_name" {
  description = "Firestore database name (use a descriptive name, not 'default')"
  type        = string
}

variable "location_id" {
  description = "Firestore location ID (e.g., eur3 for multi-region Europe)"
  type        = string
}

variable "firestore_api_service" {
  description = "Firestore API service resource for depends_on (from apis module)"
  type        = any
}

variable "secretmanager_api_service" {
  description = "Secret Manager API service resource for depends_on (from apis module)"
  type        = any
}

variable "iam_bindings_complete" {
  description = "IAM bindings completion marker to ensure permissions are set before creating Firestore resources"
  type        = any
}
