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

| Name    | Description                    | Type           | Required |
| ------- | ------------------------------ | -------------- | -------- |
| project | GCP project ID                 | `string`       | Yes      |
| users   | List of user emails for access | `list(string)` | No       |

## Outputs

None

## Notes

- **Service Accounts**: Service accounts created by Terraform should NOT be added to `users.txt`. They are managed directly in Terraform code.
- **Groups**: Currently only individual users are supported. Group support can be added if needed.
- **Free Tier**: IAM operations have no cost in GCP
