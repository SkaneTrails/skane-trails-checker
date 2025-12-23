# IAM Module - Grant permissions to users
#
# This module assigns IAM roles to users for accessing the Skåne Trails Checker project.
# All personal user emails should be defined in environments/dev/access/users.txt

# Project-level IAM bindings for users
locals {
  # Transform user list into member format
  user_members = [for email in var.users : "user:${email}"]

  # Define roles to grant to all users
  user_roles = [
    "roles/viewer",                    # Read-only access to all resources
    "roles/run.invoker",               # Invoke Cloud Run services
    "roles/datastore.user",            # Read/write Firestore data
    "roles/storage.objectViewer",      # View Cloud Storage objects
  ]
}

# Grant each role to all users
resource "google_project_iam_binding" "user_access" {
  for_each = length(var.users) > 0 ? toset(local.user_roles) : toset([])

  project = var.project
  role    = each.value
  members = local.user_members
}
