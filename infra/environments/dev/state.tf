# Terraform state bucket
# This bucket is referenced by backend.tf and must exist before terraform init
#
# IMPORTANT: If migrating from the old backend.tf layout, run:
#   terraform state mv google_storage_bucket.tfstate google_storage_bucket.tfstate
# (address is unchanged, but the file moved from backend.tf to state.tf)

resource "google_storage_bucket" "tfstate" {
  name     = var.tfstate_bucket_name
  location = "EU"
  project  = var.project

  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle {
    prevent_destroy = true
  }
}
