# Firestore Module

Creates a Firestore database for storing track statuses and foraging data, replacing CSV/JSON files with a real-time NoSQL database.

## Free Tier Compliance

- **Storage**: 1 GB free (current CSV/JSON data is ~1 MB)
- **Reads**: 50,000/day free
- **Writes**: 20,000/day free
- **Deletes**: 20,000/day free
- **Location**: Multi-region Europe (eur3) for redundancy

## Required APIs

This module depends on the following APIs being enabled (handled by the `apis` module):

- `firestore.googleapis.com` - Firestore Native database
- `secretmanager.googleapis.com` - Secret Manager for connection details

## Collections Structure

### `track_statuses`

Stores hiking trail completion statuses.

**Document fields:**

- `track_id` (string): Unique identifier for the track
- `status` (string): "To Explore" | "Explored!"
- `last_updated` (timestamp): When status was last modified

**Index**: Composite index on (track_id, status, last_updated DESC)

### `foraging_spots`

Stores foraging location data.

**Document fields:**

- `month` (string): Short month name (Jan-Dec)
- `type` (string): Foraging type (e.g., "mushroom", "berry")
- `lat` (number): Latitude
- `lng` (number): Longitude
- `notes` (string): Optional notes
- `date` (timestamp): When spot was added

**Index**: Composite index on (month, type, date DESC)

### `foraging_types`

Stores custom foraging types with emoji icons.

**Document fields:**

- `type` (string): Type name (document ID)
- `icon` (string): Emoji icon

## Secret Manager Secrets

For local debugging, connection details are stored in Secret Manager:

- `firestore-database-name` - Database name (always "(default)")
- `firestore-project-id` - GCP project ID
- `firestore-location-id` - Location ID (e.g., "eur3")

### Accessing Secrets Locally

```bash
# View database name
gcloud secrets versions access latest --secret=firestore-database-name

# View project ID
gcloud secrets versions access latest --secret=firestore-project-id

# View location ID
gcloud secrets versions access latest --secret=firestore-location-id
```

### Required IAM Roles

Users need the following roles to access secrets:

- `roles/secretmanager.secretAccessor` - Read secret values (granted by IAM module)

## Usage

```hcl
module "firestore" {
  source = "../../modules/firestore"

  project     = var.project
  location_id = var.firestore_location

  # Pass API service dependencies from apis module
  firestore_api_service     = module.apis.firestore_service
  secretmanager_api_service = module.apis.secretmanager_service

  depends_on = [module.apis]
}
```

## Variables

| Name                        | Description                                                           | Type   | Required |
| --------------------------- | --------------------------------------------------------------------- | ------ | -------- |
| `project`                   | GCP project ID                                                        | string | yes      |
| `location_id`               | Firestore location ID (e.g., eur3 for Europe multi-region)            | string | yes      |
| `firestore_api_service`     | Firestore API service resource (for depends_on from apis module)      | any    | yes      |
| `secretmanager_api_service` | Secret Manager API service resource (for depends_on from apis module) | any    | yes      |

## Outputs

| Name                   | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `database_name`        | Firestore database name                              |
| `database_id`          | Firestore database ID                                |
| `location_id`          | Firestore location ID                                |
| `database_name_secret` | Secret name for database name (not the value itself) |
| `project_id_secret`    | Secret name for project ID (not the value itself)    |
| `location_id_secret`   | Secret name for location ID (not the value itself)   |

## Notes

- Database name is set to "(default)" as required by Firestore
- Uses FIRESTORE_NATIVE mode (not Datastore mode)
- App Engine integration is disabled (not needed for Cloud Run)
- Deletion policy is set to DELETE for dev environment flexibility
- Secret replication uses `auto {}` for cost optimization (free tier)
