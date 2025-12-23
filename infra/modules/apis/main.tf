# Enable required GCP APIs for the Skåne Trails Checker application
# This module should be called first before any other modules

resource "google_project_service" "firestore" {
  project = var.project
  service = "firestore.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  project = var.project
  service = "secretmanager.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "cloudresourcemanager" {
  project = var.project
  service = "cloudresourcemanager.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "iam" {
  project = var.project
  service = "iam.googleapis.com"

  disable_on_destroy = false
}
