output "database" {
  description = "The Firestore database resource"
  value       = google_firestore_database.database
}

output "database_name" {
  description = "Firestore database name"
  value       = google_firestore_database.database.name
}

output "database_names" {
  description = "List of all Firestore database names managed by this module"
  value       = [google_firestore_database.database.name]
}

output "database_id" {
  description = "Firestore database ID"
  value       = google_firestore_database.database.id
}

output "location_id" {
  description = "Firestore location ID"
  value       = google_firestore_database.database.location_id
}

# Secret Manager secret names (not values - those are sensitive)
output "database_name_secret" {
  description = "Secret Manager secret name for Firestore database name"
  value       = google_secret_manager_secret.database_name.secret_id
}

output "project_id_secret" {
  description = "Secret Manager secret name for Firestore project ID"
  value       = google_secret_manager_secret.project_id.secret_id
}

output "location_id_secret" {
  description = "Secret Manager secret name for Firestore location ID"
  value       = google_secret_manager_secret.location_id.secret_id
}
