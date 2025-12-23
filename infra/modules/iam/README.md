# IAM Module

This module manages Identity and Access Management (IAM) permissions for the Skåne Trails Checker project.

## Purpose

Grants necessary permissions to users who need access to the project resources. All personal user emails should be managed through the `users.txt` file in each environment's `access/` directory.

## Roles Granted

Users listed in `users.txt` receive the following roles:

- **Viewer** (`roles/viewer`) - Read-only access to all project resources
- **Cloud Run Invoker** (`roles/run.invoker`) - Ability to access deployed Cloud Run services
- **Firestore User** (`roles/datastore.user`) - Read and write access to Firestore database
- **Storage Object Viewer** (`roles/storage.objectViewer`) - View GPX files in Cloud Storage buckets

## Usage

### Add a User

1. Add the user's email to `infra/environments/dev/access/users.txt`:

   ```text
   alice@example.com
   ```

2. Update the `users` variable in `terraform.tfvars` to load from the file
3. Run `terraform apply` to grant access

### Remove a User

1. Remove the user's email from `users.txt`
2. Run `terraform apply` to revoke access

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
