# IAM Module

This module manages Identity and Access Management (IAM) permissions for the Skåne Trails Checker project, including custom role definitions and user access bindings.

## Purpose

- Defines custom IAM roles tailored to project needs
- Grants necessary permissions to users who need access to project resources
- All personal user emails should be managed through the `users.txt` file in each environment's `access/` directory

## Custom Roles (defined in custom_roles.tf)

### 1. Infrastructure Manager (`skaneTrailsInfraManager`)

**Purpose**: Create and manage infrastructure via Terraform

**Permissions**:

- Create/update/delete Firestore databases and indexes
- Create/update/delete Secret Manager secrets
- Manage Cloud Storage buckets and objects
- Create/update/delete Cloud Run services
- Manage IAM bindings
- Enable GCP services

**Who needs this**:

- Developers during initial setup (temporary)
- CI/CD service accounts (permanent)

**Revocation**: Should be revoked from individual developers after infrastructure is deployed

### 2. App User (`skaneTrailsAppUser`)

**Purpose**: Runtime access to read/write data and invoke services

**Permissions**:

- Read/write Firestore entities (track statuses, foraging spots)
- Access Secret Manager secrets (read-only)
- Read Cloud Storage objects (GPX files)
- Invoke Cloud Run services
- View basic project information

**Who needs this**:

- All app developers and users (permanent)
- Cloud Run service account (permanent)

## Predefined Roles Granted

Users listed in `users.txt` also receive:

- **Viewer** (`roles/viewer`) - Read-only access to all project resources

## Google Play Publisher Service Account

`google_service_account.play_publisher` (`st-play-publisher` by default) is the identity EAS Submit uses to publish Android app bundles to Google Play. It has **no GCP IAM roles**: its permissions are granted in Play Console by inviting its email under Users and permissions. The Google Play Android Developer API it calls is enabled by the `apis` module.

The JSON key is intentionally **not** managed by Terraform (a managed key would put the private key in state). See the "Android release pipeline" section of [docs/DEVELOPMENT.md](../../../docs/DEVELOPMENT.md) for creating the key and the other one-time Play setup.

## Usage

### Add a User

1. Add the user's email to `infra/environments/dev/access/users.txt`:

   ```text
   alice@example.com
   ```

1. Update the `users` variable in `terraform.tfvars` to load from the file

1. Run `terraform apply` to grant access

### Remove a User

1. Remove the user's email from `users.txt`
1. Run `terraform apply` to revoke access

## Variables

| Name                      | Description                                     | Type           | Required |
| ------------------------- | ----------------------------------------------- | -------------- | -------- |
| project                   | GCP project ID                                  | `string`       | Yes      |
| users                     | List of user emails for access                  | `list(string)` | No       |
| play_publisher_account_id | Account ID of the Google Play publisher account | `string`       | No       |

## Outputs

| Name                   | Description                                                             |
| ---------------------- | ----------------------------------------------------------------------- |
| `play_publisher_email` | Email of the Play publisher service account (invite it in Play Console) |

## Notes

- **Service Accounts**: Service accounts created by Terraform should NOT be added to `users.txt`. They are managed directly in Terraform code.
- **Groups**: Currently only individual users are supported. Group support can be added if needed.
- **Free Tier**: IAM operations have no cost in GCP
