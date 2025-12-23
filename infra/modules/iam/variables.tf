variable "project" {
  description = "GCP project ID"
  type        = string
}

variable "users" {
  description = "List of user emails to grant access"
  type        = list(string)
}

variable "iam_api_service" {
  description = "IAM API service dependency from apis module (for implicit ordering)"
  type        = any
  default     = null
}
