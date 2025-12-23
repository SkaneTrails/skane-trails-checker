output "infrastructure_manager_role_id" {
  description = "Full role ID for Infrastructure Manager custom role"
  value       = google_project_iam_custom_role.infrastructure_manager.id
}

output "app_user_role_id" {
  description = "Full role ID for App User custom role"
  value       = google_project_iam_custom_role.app_user.id
}

output "infrastructure_manager_role_name" {
  description = "Role name for Infrastructure Manager (projects/PROJECT_ID/roles/ROLE_ID)"
  value       = google_project_iam_custom_role.infrastructure_manager.name
}

output "app_user_role_name" {
  description = "Role name for App User (projects/PROJECT_ID/roles/ROLE_ID)"
  value       = google_project_iam_custom_role.app_user.name
}

output "iam_bindings_complete" {
  description = "Dummy output to ensure all IAM bindings are complete before dependent resources"
  value       = "complete"
  depends_on = [
    google_project_iam_binding.prerequisite_roles,
    google_project_iam_custom_role.infrastructure_manager,
    google_project_iam_custom_role.app_user,
    google_project_iam_binding.user_access,
    time_sleep.wait_for_iam_propagation,
  ]
}
