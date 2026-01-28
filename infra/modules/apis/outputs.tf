output "firestore_service" {
  description = "Firestore API service resource for depends_on"
  value       = google_project_service.firestore
}

output "secretmanager_service" {
  description = "Secret Manager API service resource for depends_on"
  value       = google_project_service.secretmanager
}

output "cloudresourcemanager_service" {
  description = "Cloud Resource Manager API service resource for depends_on"
  value       = google_project_service.cloudresourcemanager
}

output "iam_service" {
  description = "IAM API service resource for depends_on"
  value       = google_project_service.iam
}

# Backup-related API outputs
output "storage_service" {
  description = "Cloud Storage API service resource for depends_on"
  value       = google_project_service.storage
}

output "cloudfunctions_service" {
  description = "Cloud Functions API service resource for depends_on"
  value       = google_project_service.cloudfunctions
}

output "cloudbuild_service" {
  description = "Cloud Build API service resource for depends_on"
  value       = google_project_service.cloudbuild
}

output "cloudscheduler_service" {
  description = "Cloud Scheduler API service resource for depends_on"
  value       = google_project_service.cloudscheduler
}

output "run_service" {
  description = "Cloud Run API service resource for depends_on"
  value       = google_project_service.run
}
