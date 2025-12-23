# GitHub Configuration for Terraform

This document describes the GitHub configuration for Terraform validation workflows.

## Workflows

### Terraform Checks (`terraform-checks.yml`)

Runs automatically on PRs that modify Terraform files:

- **terraform fmt**: Format validation
- **terraform validate**: Syntax and configuration validation
- **tflint**: Linting with Google provider rules
- **trivy**: Security scanning for misconfigurations

## Local Development

### Bootstrap

Create the Terraform state bucket (one-time setup):

1. Update `infra/environments/dev/init/terraform.tfvars` locally with your project ID
2. Run bootstrap: `cd infra/environments/dev/init && terraform init && terraform apply`
3. Import state bucket: `cd .. && ./import_tfstate_bucket.ps1` (Windows) or `./import_tfstate_bucket.sh` (Linux/macOS)

### Deploy Changes

After bootstrap, deploy infrastructure changes locally:

1. Update `infra/environments/dev/terraform.tfvars` with your configuration
2. Initialize backend: `cd infra/environments/dev && terraform init`
3. Plan changes: `terraform plan`
4. Apply changes: `terraform apply`

## Security Notes

- **Never commit** `terraform.tfvars` or `backend.tf` to git (gitignored)
- **All infrastructure** (including WIF, service accounts) is managed via Terraform
- **Deployments** are currently done locally; automated GitHub Actions deployments will be added later


