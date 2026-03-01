variable "project" {
  description = "GCP project ID"
  type        = string
}

variable "users" {
  description = "List of user email addresses to grant access to"
  type        = list(string)
  default     = []
}

variable "superusers" {
  description = "List of superuser email addresses (also get IAM access)"
  type        = list(string)
  default     = []
}

variable "iam_api_service" {
  description = "IAM API service dependency from apis module (for implicit ordering)"
  type        = any
  default     = null
}
