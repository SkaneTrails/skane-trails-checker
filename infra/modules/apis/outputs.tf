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

output "artifactregistry_service" {
  description = "Artifact Registry API service resource for depends_on"
  value       = google_project_service.artifactregistry
}

output "firebase_service" {
  description = "Firebase API service resource for depends_on"
  value       = google_project_service.firebase
}

output "firebaserules_service" {
  description = "Firebase Rules API service resource for depends_on"
  value       = google_project_service.firebaserules
}

output "identitytoolkit_service" {
  description = "Identity Toolkit (Firebase Auth) API service resource for depends_on"
  value       = google_project_service.identitytoolkit
}

output "iamcredentials_service" {
  description = "IAM Credentials API service resource (for Workload Identity Federation)"
  value       = google_project_service.iamcredentials
}
