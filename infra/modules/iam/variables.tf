variable "project" {
  description = "GCP project ID"
  type        = string
}

variable "users" {
  description = "List of user emails to grant access"
  type        = list(string)
}
