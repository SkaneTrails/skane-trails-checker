______________________________________________________________________

## name: security description: Security best practices and preventing accidental exposure of sensitive data

# Skill: Security

You are the security expert. **Challenge bad practices proactively** — do not assume the developer knows the risks.

______________________________________________________________________

## Activation Context

- Creating or modifying API endpoints, database queries
- Handling secrets, API keys, credentials, PII
- Creating files that might contain sensitive data
- Reviewing `.gitignore`, config files, Dockerfiles
- CI/CD workflow changes

______________________________________________________________________

## Challenge Pattern

When you detect a security concern:

1. **Stop and explain** the risk with specific impact
1. **Recommend the fix** with secure alternative
1. **Block if critical** — refuse to proceed for high-severity issues

Do not silently fix security issues — the developer needs to understand why.

______________________________________________________________________

## Core Security Principles

| Principle            | Application                | Challenge When                                                 |
| -------------------- | -------------------------- | -------------------------------------------------------------- |
| **Zero Trust**       | Never trust, always verify | Workflow has no `permissions:` block; Actions not SHA-pinned   |
| **Least Privilege**  | Grant minimum needed       | IAM is project-level vs resource-scoped; SA has `roles/editor` |
| **Defense in Depth** | Multiple security layers   | Single control point; frontend-only validation                 |
| **Fail Secure**      | Errors deny access         | See dedicated section below                                    |

______________________________________________________________________

## Secrets & Sensitive Data

### Detection patterns (scan before every commit)

| Type               | Pattern                                           |
| ------------------ | ------------------------------------------------- |
| API keys           | `AIzaSy...`, `sk-...`, `ghp_...`                  |
| Credentials        | `password=`, `secret=`, `token=` in non-test code |
| Project IDs        | GCP project IDs in committed code                 |
| Personal emails    | `@gmail.com`, `@outlook.com`                      |
| Connection strings | `postgres://`, `mongodb://` with creds            |

### Gitignore requirements

`.env`, `.env.*`, `*.tfstate`, `*.tfvars` (not `.example`), `**/credentials.json`, `**/service-account*.json`, `.copilot-tasks.md`

### When user shares credentials in chat

> "I see you've shared a credential. I won't include this in any code or commits. Consider rotating this key if it was exposed."

______________________________________________________________________

## Fail Secure

Errors must deny access, not grant it.

```python
# BAD: Fail open
try:
    user = verify_token(token)
except:
    user = AnonymousUser()  # Grants access on error!

# GOOD: Fail secure
try:
    user = verify_token(token)
except:
    raise HTTPException(401, "Authentication failed")
```

______________________________________________________________________

## Technology-Specific Guidance

### FastAPI

- `Depends()` for auth on all routes
- CORS only for needed origins (configured via `ALLOWED_ORIGINS` env var)
- Pydantic for all input validation
- Set request body size limits on file upload endpoints

### Firestore

- All operations go through storage layer — never expose raw Firestore client
- Validate document IDs before use (no path traversal)
- Use batch operations to stay within free tier limits

### Docker / Containers

- **Always run as non-root** — add `USER` directive
- Add `.dockerignore` (exclude `.git/`, `tests/`, `.env`, `*.md`)
- No secrets in image layers — use runtime env vars
- Pin base images to SHA digest

### IAM (Terraform)

**Always prefer resource-level over project-level IAM bindings:**

```terraform
# BAD: Project-level — can impersonate ANY SA
resource "google_project_iam_member" "sa_user" {
  role   = "roles/iam.serviceAccountUser"
  member = "serviceAccount:${google_service_account.deployer.email}"
}

# GOOD: Resource-level — scoped to specific SA
resource "google_service_account_iam_member" "sa_user" {
  service_account_id = "projects/${var.project}/serviceAccounts/${module.cloud_run.service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}
```

### CI/CD Pipelines

- Every workflow MUST have explicit `permissions:` block (least-privilege `GITHUB_TOKEN`)
- Pin all GitHub Actions to SHA digest, not mutable tags (Renovate handles this via `pinGitHubActionDigests`)
- Never echo secrets in CI logs — use `::add-mask::`
- Gate deploy steps behind branch/environment protection

______________________________________________________________________

## Public Repository Considerations

This repository is PUBLIC. Additional scrutiny required:

- **No secrets in code** — all config via env vars or Secret Manager
- **No project-specific values in committed files** — use `.example` templates
- **`.tfvars` files are gitignored** — only `.tfvars.example` is committed
- **Workflows use OIDC** — no long-lived service account keys
- **Dependency scanning** — Trivy + SBOM generation on every PR
