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
  description = "Marker output to ensure all IAM bindings (users + Terraform SA) are complete before dependent resources"
  value = {
    user_access        = google_project_iam_binding.user_access
    terraform_ci       = google_project_iam_member.github_actions_terraform_ci
    terraform_cd       = google_project_iam_member.github_actions_terraform_cd
    terraform_sa       = google_project_iam_member.github_actions_terraform_sa_admin
    terraform_secrets  = google_project_iam_member.github_actions_terraform_secrets
    terraform_firebase = google_project_iam_member.github_actions_terraform_firebase
    terraform_wif      = google_project_iam_member.github_actions_terraform_wif
  }
}

output "github_actions_firebase_service_account" {
  description = "Service account for GitHub Actions Firebase Hosting deployment"
  value       = google_service_account.github_actions_firebase
}

output "github_actions_firebase_email" {
  description = "Email of the GitHub Actions Firebase service account"
  value       = google_service_account.github_actions_firebase.email
}

output "github_actions_cloudrun_service_account" {
  description = "Service account for GitHub Actions Cloud Run deployment"
  value       = google_service_account.github_actions_cloudrun
}

output "github_actions_cloudrun_email" {
  description = "Email of the GitHub Actions Cloud Run service account"
  value       = google_service_account.github_actions_cloudrun.email
}

output "github_actions_terraform_service_account" {
  description = "Service account for GitHub Actions Terraform deployment"
  value       = google_service_account.github_actions_terraform
}

output "github_actions_terraform_email" {
  description = "Email of the GitHub Actions Terraform service account"
  value       = google_service_account.github_actions_terraform.email
}

output "local_dev_service_account" {
  description = "Service account for local development"
  value       = google_service_account.local_dev
}

output "local_dev_email" {
  description = "Email of the local development service account"
  value       = google_service_account.local_dev.email
}
