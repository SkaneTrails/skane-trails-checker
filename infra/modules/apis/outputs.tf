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
