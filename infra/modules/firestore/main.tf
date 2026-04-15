# Firestore database for storing track statuses and foraging data
# Replaces CSV/JSON files with real-time NoSQL database
# Free tier: 1 GB storage, 50K reads/day, 20K writes/day

resource "google_firestore_database" "database" {
  project     = var.project
  name        = var.database_name
  location_id = var.location_id
  type        = "FIRESTORE_NATIVE"

  # Free tier compatible settings
  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"

  # Prevent accidental deletion of production data
  deletion_policy = "ABANDON"

  depends_on = [var.firestore_api_service, var.iam_bindings_complete]
}

# Secret Manager secrets for local debugging
# Stores connection details without hardcoding in code
resource "google_secret_manager_secret" "database_name" {
  project   = var.project
  secret_id = "firestore-database-name"

  replication {
    auto {}
  }

  depends_on = [var.secretmanager_api_service]
}

resource "google_secret_manager_secret" "project_id" {
  project   = var.project
  secret_id = "firestore-project-id"

  replication {
    auto {}
  }

  depends_on = [var.secretmanager_api_service]
}

resource "google_secret_manager_secret" "location_id" {
  project   = var.project
  secret_id = "firestore-location-id"

  replication {
    auto {}
  }

  depends_on = [var.secretmanager_api_service]
}

# Secret versions with actual values
resource "google_secret_manager_secret_version" "database_name" {
  secret      = google_secret_manager_secret.database_name.id
  secret_data = google_firestore_database.database.name
}

resource "google_secret_manager_secret_version" "project_id" {
  secret      = google_secret_manager_secret.project_id.id
  secret_data = var.project
}

resource "google_secret_manager_secret_version" "location_id" {
  secret      = google_secret_manager_secret.location_id.id
  secret_data = var.location_id
}

# Firestore indexes for efficient querying
# Track statuses collection
resource "google_firestore_index" "track_status_index" {
  project    = var.project
  database   = google_firestore_database.database.name
  collection = "track_statuses"

  fields {
    field_path = "track_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "status"
    order      = "ASCENDING"
  }

  fields {
    field_path = "last_updated"
    order      = "DESCENDING"
  }
}

# Firestore security rules — deny all client SDK access
# Admin SDK (used by FastAPI backend) bypasses rules entirely.
resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = var.project

  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/../../../firestore.rules")
    }
  }

  depends_on = [var.firebaserules_api_service, google_firestore_database.database]
}

resource "google_firebaserules_release" "firestore" {
  provider     = google-beta
  project      = var.project
  name         = "cloud.firestore/database/${var.database_name}"
  ruleset_name = google_firebaserules_ruleset.firestore.name

  depends_on = [var.firebaserules_api_service]
}

# Foraging spots collection index
resource "google_firestore_index" "foraging_spots_index" {
  project    = var.project
  database   = google_firestore_database.database.name
  collection = "foraging_spots"

  fields {
    field_path = "month"
    order      = "ASCENDING"
  }

  fields {
    field_path = "type"
    order      = "ASCENDING"
  }

  fields {
    field_path = "date"
    order      = "DESCENDING"
  }
}

# Trails collection indexes for delta sync (modified_at filtering)
resource "google_firestore_index" "trails_source_modified_at" {
  project    = var.project
  database   = google_firestore_database.database.name
  collection = "trails"

  fields {
    field_path = "source"
    order      = "ASCENDING"
  }

  fields {
    field_path = "modified_at"
    order      = "ASCENDING"
  }
}

resource "google_firestore_index" "trails_group_modified_at" {
  project    = var.project
  database   = google_firestore_database.database.name
  collection = "trails"

  fields {
    field_path = "group_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "modified_at"
    order      = "ASCENDING"
  }
}

resource "google_firestore_index" "trails_is_public_modified_at" {
  project    = var.project
  database   = google_firestore_database.database.name
  collection = "trails"

  fields {
    field_path = "is_public"
    order      = "ASCENDING"
  }

  fields {
    field_path = "modified_at"
    order      = "ASCENDING"
  }
}
