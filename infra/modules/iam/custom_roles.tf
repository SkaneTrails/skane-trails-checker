# Custom IAM Roles for Skåne Trails Checker
#
# Four roles:
# 1. Infrastructure Manager - Create and manage all infrastructure (can be revoked after setup)
# 2. App User - Runtime data access (permanent)
# 3. Terraform CI - Read-only for terraform plan (GitHub Actions)
# 4. Terraform CD - Write operations for terraform apply (GitHub Actions)
#
# When splitting into separate CI/CD service accounts:
#   CI SA: terraform_ci only
#   CD SA: terraform_ci + terraform_cd + predefined roles (see main.tf)

# Infrastructure Manager Role
# Grants permissions needed to create and manage infrastructure via Terraform
resource "google_project_iam_custom_role" "infrastructure_manager" {
  role_id     = "skaneTrailsInfraManager"
  title       = "Skåne Trails Infrastructure Manager"
  description = "Permissions to create and manage Firestore, Secret Manager, and related infrastructure. Used by developers during setup and CI/CD pipelines."

  permissions = [
    # Firestore/Datastore permissions
    "datastore.databases.create",
    "datastore.databases.delete",
    "datastore.databases.get",
    "datastore.databases.list",
    "datastore.databases.update",
    "datastore.indexes.create",
    "datastore.indexes.delete",
    "datastore.indexes.get",
    "datastore.indexes.list",
    "datastore.indexes.update",

    # Secret Manager permissions
    "secretmanager.secrets.create",
    "secretmanager.secrets.delete",
    "secretmanager.secrets.get",
    "secretmanager.secrets.list",
    "secretmanager.secrets.update",
    "secretmanager.versions.add",
    "secretmanager.versions.destroy",
    "secretmanager.versions.disable",
    "secretmanager.versions.enable",
    "secretmanager.versions.get",
    "secretmanager.versions.list",

    # Cloud Storage permissions (for state bucket)
    "storage.buckets.create",
    "storage.buckets.delete",
    "storage.buckets.get",
    "storage.buckets.list",
    "storage.buckets.update",
    "storage.objects.create",
    "storage.objects.delete",
    "storage.objects.get",
    "storage.objects.list",

    # Cloud Run permissions
    "run.services.create",
    "run.services.delete",
    "run.services.get",
    "run.services.list",
    "run.services.update",

    # Artifact Registry permissions
    "artifactregistry.repositories.create",
    "artifactregistry.repositories.delete",
    "artifactregistry.repositories.get",
    "artifactregistry.repositories.list",

    # IAM permissions (to manage user access)
    "iam.roles.get",
    "iam.roles.list",
    "resourcemanager.projects.get",

    # Service management
    "serviceusage.services.enable",
    "serviceusage.services.get",
    "serviceusage.services.list",
  ]

  project = var.project

  # Must wait for prerequisite roles to be granted
  depends_on = [google_project_iam_binding.prerequisite_roles]
}

# App User Role
# Grants permissions needed to access data and invoke Cloud Run services
resource "google_project_iam_custom_role" "app_user" {
  role_id     = "skaneTrailsAppUser"
  title       = "Skåne Trails App User"
  description = "Runtime permissions to read/write Firestore data, access secrets, and invoke Cloud Run services. Used by app users during normal operation."

  permissions = [
    # Firestore data access
    "datastore.entities.create",
    "datastore.entities.delete",
    "datastore.entities.get",
    "datastore.entities.list",
    "datastore.entities.update",
    "datastore.databases.get",
    "datastore.indexes.get",
    "datastore.indexes.list",

    # Secret Manager read access
    "secretmanager.secrets.get",
    "secretmanager.secrets.list",
    "secretmanager.versions.access",
    "secretmanager.versions.get",
    "secretmanager.versions.list",

    # Cloud Storage read access (for GPX files)
    "storage.buckets.get",
    "storage.buckets.list",
    "storage.objects.get",
    "storage.objects.list",

    # Cloud Run invoke
    "run.services.get",
    "run.routes.invoke",

    # Basic project info
    "resourcemanager.projects.get",
  ]

  project = var.project

  # Must wait for prerequisite roles to be granted
  depends_on = [google_project_iam_binding.prerequisite_roles]
}

# -----------------------------------------------------------------------------
# Terraform CI Role (terraform plan — read-only + state lock)
# -----------------------------------------------------------------------------
# Covers all resource types managed by Terraform. If a new module adds a new
# resource type, add its read permissions here. Plan will fail with a clear
# "permission denied" error if a permission is missing.

resource "google_project_iam_custom_role" "terraform_ci" {
  role_id     = "skaneTrailsTerraformCI"
  title       = "Skåne Trails Terraform CI"
  description = "Read-only permissions for terraform plan in GitHub Actions CI. Includes state lock writes."

  permissions = [
    # Artifact Registry
    "artifactregistry.repositories.get",
    "artifactregistry.repositories.list",

    # Cloud Build (used by Cloud Functions v2)
    "cloudbuild.builds.get",
    "cloudbuild.builds.list",

    # Cloud Functions
    "cloudfunctions.functions.get",
    "cloudfunctions.functions.list",
    "cloudfunctions.locations.list",
    "cloudfunctions.operations.get",

    # Cloud Scheduler
    "cloudscheduler.jobs.get",
    "cloudscheduler.jobs.list",

    # Firestore / Datastore
    "datastore.databases.get",
    "datastore.databases.list",
    "datastore.entities.get",
    "datastore.entities.list",
    "datastore.indexes.get",
    "datastore.indexes.list",

    # Firebase
    "firebase.projects.get",
    "firebasehosting.sites.get",
    "firebasehosting.sites.list",

    # IAM
    "iam.roles.get",
    "iam.roles.list",
    "iam.serviceAccounts.get",
    "iam.serviceAccounts.getIamPolicy",
    "iam.serviceAccounts.list",
    "iam.workloadIdentityPoolProviders.get",
    "iam.workloadIdentityPoolProviders.list",
    "iam.workloadIdentityPools.get",
    "iam.workloadIdentityPools.list",

    # Identity Platform
    "identitytoolkit.tenants.get",
    "identitytoolkit.tenants.list",

    # Project
    "resourcemanager.projects.get",
    "resourcemanager.projects.getIamPolicy",

    # Cloud Run
    "run.operations.get",
    "run.operations.list",
    "run.services.get",
    "run.services.getIamPolicy",
    "run.services.list",

    # Secret Manager
    "secretmanager.secrets.get",
    "secretmanager.secrets.getIamPolicy",
    "secretmanager.secrets.list",
    "secretmanager.versions.get",
    "secretmanager.versions.list",

    # Service Usage (APIs)
    "serviceusage.services.get",
    "serviceusage.services.list",

    # Cloud Storage (read-only — state lock writes are bucket-scoped, see main.tf)
    "storage.buckets.get",
    "storage.buckets.getIamPolicy",
    "storage.buckets.list",
    "storage.objects.get",
    "storage.objects.list",
  ]

  project = var.project

  depends_on = [google_project_iam_binding.prerequisite_roles]
}

# -----------------------------------------------------------------------------
# Terraform CD Role (terraform apply — write operations)
# -----------------------------------------------------------------------------
# Additive to CI role. Contains write/create/update/delete permissions for
# resource types managed by our Terraform config, plus operational reads
# (e.g. cloudfunctions.operations.get) needed only during apply.
#
# Permissions NOT included here (covered by predefined roles on the SA):
#   roles/iam.serviceAccountAdmin  — SA lifecycle
#   roles/secretmanager.admin      — secret + version lifecycle
#   roles/firebase.admin           — Firebase, Hosting, Identity Platform
#   roles/iam.workloadIdentityPoolAdmin — WIF pool/provider lifecycle
#   prerequisite_roles binding     — custom role + IAM policy management

resource "google_project_iam_custom_role" "terraform_cd" {
  role_id     = "skaneTrailsTerraformCD"
  title       = "Skåne Trails Terraform CD"
  description = "Write permissions for terraform apply and Docker push in GitHub Actions CD. Pair with CI role + predefined roles."

  permissions = [
    # Artifact Registry (repos + Docker push)
    "artifactregistry.repositories.create",
    "artifactregistry.repositories.delete",
    "artifactregistry.repositories.downloadArtifacts",
    "artifactregistry.repositories.update",
    "artifactregistry.repositories.uploadArtifacts",

    # Cloud Build (used internally by Cloud Functions v2)
    "cloudbuild.builds.create",

    # Cloud Functions
    "cloudfunctions.functions.create",
    "cloudfunctions.functions.delete",
    "cloudfunctions.functions.update",

    # Cloud Scheduler
    "cloudscheduler.jobs.create",
    "cloudscheduler.jobs.delete",
    "cloudscheduler.jobs.update",

    # Firestore / Datastore (no databases.delete — defense-in-depth with deletion_policy=ABANDON)
    "datastore.databases.create",
    "datastore.databases.update",
    "datastore.entities.create",
    "datastore.entities.delete",
    "datastore.entities.update",
    "datastore.indexes.create",
    "datastore.indexes.delete",
    "datastore.indexes.update",

    # Cloud Run
    "run.services.create",
    "run.services.delete",
    "run.services.setIamPolicy",
    "run.services.update",

    # Service Usage (enable/disable APIs)
    "serviceusage.services.disable",
    "serviceusage.services.enable",

    # Cloud Storage (state writes, backup bucket management)
    "storage.buckets.create",
    "storage.buckets.delete",
    "storage.buckets.setIamPolicy",
    "storage.buckets.update",
    "storage.objects.update",
  ]

  project = var.project

  depends_on = [google_project_iam_binding.prerequisite_roles]
}
