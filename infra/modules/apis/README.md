# APIs Module

Enables all required GCP APIs for the Skåne Trails Checker application.

## Purpose

This module must be called **first** in the environment configuration (before IAM, Firestore, or any other modules) to ensure all required APIs are enabled before resources are created.

## APIs Enabled

- `firestore.googleapis.com` - Firestore Native database for storing track statuses and foraging data
- `secretmanager.googleapis.com` - Secret Manager for storing connection details
- `cloudresourcemanager.googleapis.com` - Cloud Resource Manager for project-level operations
- `iam.googleapis.com` - Identity and Access Management for permission management

## Free Tier Compliance

All APIs listed are free to enable and use within the limits of their respective free tiers:

- Firestore: 1 GB storage, 50K reads/day, 20K writes/day
- Secret Manager: 6 active secret versions (we use 3)
- No charges for API enablement itself

## Usage

```hcl
module "apis" {
  source = "../../modules/apis"

  project = var.project
}

# Other modules should depend on APIs being enabled
module "firestore" {
  source = "../../modules/firestore"

  project     = var.project
  location_id = var.firestore_location

  # Ensure Firestore API is enabled first
  depends_on = [module.apis]
}
```

## Variables

| Name      | Description    | Type   | Required |
| --------- | -------------- | ------ | -------- |
| `project` | GCP project ID | string | yes      |

## Outputs

| Name                           | Description                                                  |
| ------------------------------ | ------------------------------------------------------------ |
| `firestore_service`            | Firestore API service resource (for depends_on)              |
| `secretmanager_service`        | Secret Manager API service resource (for depends_on)         |
| `cloudresourcemanager_service` | Cloud Resource Manager API service resource (for depends_on) |
| `iam_service`                  | IAM API service resource (for depends_on)                    |

## Notes

- `disable_on_destroy = false` prevents accidental service disruption if Terraform is destroyed
- API enablement can take 1-2 minutes on first apply
- Once enabled, APIs remain enabled even if this module is removed from config
