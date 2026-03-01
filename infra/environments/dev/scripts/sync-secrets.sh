#!/usr/bin/env bash
# Sync local config files to GitHub repository secrets
#
# Reads terraform.tfvars, backend.tf, and access/superusers.txt (all gitignored)
# and stores their values as GitHub secrets so CI/CD workflows can use them.
#
# Secrets created:
#   GCP_PROJECT_ID      - from terraform.tfvars "project"
#   GCP_PROJECT_NUMBER  - fetched via gcloud from the project ID
#   GCP_REGION          - from terraform.tfvars "region"
#   TF_BACKEND_BUCKET   - from backend.tf "bucket"
#   TF_BACKEND_PREFIX   - from backend.tf "prefix"
#   TF_VARS_FILE        - entire terraform.tfvars content
#   TF_SUPERUSERS       - access/superusers.txt (comments/blanks stripped)
#
# Prerequisites:
#   - gh CLI authenticated (gh auth login)
#   - gcloud CLI authenticated (gcloud auth login)
#   - Local files exist (run bootstrap first)
#
# Usage: ./sync-secrets.sh [owner/repo]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_DIR="$SCRIPT_DIR/.."
ACCESS_DIR="$ENV_DIR/access"
TFVARS_PATH="$ENV_DIR/terraform.tfvars"
BACKEND_PATH="$ENV_DIR/backend.tf"

# Detect repo from git remote if not provided
if [[ -n "${1:-}" ]]; then
    REPO="$1"
else
    remote_url=$(git remote get-url origin 2>/dev/null || true)
    REPO=$(echo "$remote_url" | sed -E 's#.+[:/]([^/]+/[^/.]+?)(\.git)?$#\1#')
    if [[ -z "$REPO" || "$REPO" == "$remote_url" ]]; then
        echo "Error: Could not detect repository. Pass owner/name as argument." >&2
        exit 1
    fi
fi

echo -e "\033[36mSyncing secrets to GitHub repository\033[0m"
echo -e "\033[90mRepository: $REPO\033[0m"
echo ""

# Verify prerequisites
if ! gh auth status &>/dev/null; then
    echo "Error: gh CLI not authenticated. Run 'gh auth login' first." >&2
    exit 1
fi

if ! command -v gcloud &>/dev/null; then
    echo "Error: gcloud CLI not found. Install Google Cloud SDK first." >&2
    exit 1
fi

# Helper: read file, strip comments and blank lines
clean_content() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        return 1
    fi
    grep -v '^[[:space:]]*#' "$file" | grep -v '^[[:space:]]*$' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Helper: extract a value from terraform.tfvars (key = "value")
extract_tfvar() {
    local key="$1"
    grep -E "^[[:space:]]*${key}[[:space:]]*=" "$TFVARS_PATH" \
        | grep -Ev '^[[:space:]]*#' \
        | sed -E 's/.*=[[:space:]]*"(.*)".*/\1/' \
        | head -n 1
}

synced=0
errors=0

# --- terraform.tfvars ---
if [[ ! -f "$TFVARS_PATH" ]]; then
    echo "Error: terraform.tfvars not found at $TFVARS_PATH" >&2
    echo "  Run bootstrap first. See infra/environments/dev/init/README.md" >&2
    exit 1
fi

# 1. GCP_PROJECT_ID
PROJECT_ID=$(extract_tfvar "project")
if [[ -n "$PROJECT_ID" ]]; then
    echo -n "$PROJECT_ID" | gh secret set GCP_PROJECT_ID --repo "$REPO"
    echo -e "  \033[32mGCP_PROJECT_ID\033[0m = $PROJECT_ID"
    ((synced += 1))
else
    echo -e "  \033[31mError: Could not extract 'project' from terraform.tfvars\033[0m"
    ((errors += 1))
fi

# 2. GCP_PROJECT_NUMBER (fetched from GCP)
if [[ -n "$PROJECT_ID" ]]; then
    echo -e "  \033[90mFetching project number from GCP...\033[0m"
    PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" 2>/dev/null || true)
    if [[ -n "$PROJECT_NUMBER" ]]; then
        echo -n "$PROJECT_NUMBER" | gh secret set GCP_PROJECT_NUMBER --repo "$REPO"
        echo -e "  \033[32mGCP_PROJECT_NUMBER\033[0m = $PROJECT_NUMBER"
        ((synced += 1))
    else
        echo -e "  \033[31mError: Could not fetch project number. Check gcloud auth.\033[0m"
        ((errors += 1))
    fi
fi

# 3. GCP_REGION
REGION=$(extract_tfvar "region")
if [[ -n "$REGION" ]]; then
    echo -n "$REGION" | gh secret set GCP_REGION --repo "$REPO"
    echo -e "  \033[32mGCP_REGION\033[0m = $REGION"
    ((synced += 1))
else
    echo -e "  \033[31mError: Could not extract 'region' from terraform.tfvars\033[0m"
    ((errors += 1))
fi

# 4. TF_VARS_FILE (entire tfvars content)
gh secret set TF_VARS_FILE --repo "$REPO" < "$TFVARS_PATH"
echo -e "  \033[32mTF_VARS_FILE\033[0m (terraform.tfvars content)"
((synced += 1))

# --- backend.tf ---
if [[ -f "$BACKEND_PATH" ]]; then
    # 5. TF_BACKEND_BUCKET
    BUCKET=$(grep -A 10 'backend.*"gcs"' "$BACKEND_PATH" | grep -E '^[[:space:]]*bucket[[:space:]]*=' | sed -E 's/.*=[[:space:]]*"(.*)".*/\1/' | head -n 1)
    if [[ -n "$BUCKET" ]]; then
        echo -n "$BUCKET" | gh secret set TF_BACKEND_BUCKET --repo "$REPO"
        echo -e "  \033[32mTF_BACKEND_BUCKET\033[0m = $BUCKET"
        ((synced += 1))
    else
        echo -e "  \033[31mError: Could not extract bucket from backend.tf\033[0m"
        ((errors += 1))
    fi

    # 6. TF_BACKEND_PREFIX
    PREFIX=$(grep -A 10 'backend.*"gcs"' "$BACKEND_PATH" | grep -E '^[[:space:]]*prefix[[:space:]]*=' | sed -E 's/.*=[[:space:]]*"(.*)".*/\1/' | head -n 1)
    if [[ -n "$PREFIX" ]]; then
        echo -n "$PREFIX" | gh secret set TF_BACKEND_PREFIX --repo "$REPO"
        echo -e "  \033[32mTF_BACKEND_PREFIX\033[0m = $PREFIX"
        ((synced += 1))
    else
        echo -e "  \033[31mError: Could not extract prefix from backend.tf\033[0m"
        ((errors += 1))
    fi
else
    echo -e "  \033[33mSkipping backend.tf (not found)\033[0m"
fi

# --- access/superusers.txt ---
# 7. TF_SUPERUSERS
SU_CONTENT=$(clean_content "$ACCESS_DIR/superusers.txt" 2>/dev/null || true)
if [[ -n "$SU_CONTENT" ]]; then
    count=$(echo "$SU_CONTENT" | wc -l | tr -d ' ')
    echo -n "$SU_CONTENT" | gh secret set TF_SUPERUSERS --repo "$REPO"
    echo -e "  \033[32mTF_SUPERUSERS\033[0m ($count email(s))"
    ((synced += 1))
else
    echo -e "  \033[33mSkipping superusers.txt (empty or not found)\033[0m"
fi

# --- Summary ---
echo ""
if [[ $errors -gt 0 ]]; then
    echo -e "\033[31mSynced $synced secret(s) with $errors error(s)\033[0m"
    exit 1
elif [[ $synced -gt 0 ]]; then
    echo -e "\033[32mSynced $synced secret(s) to GitHub\033[0m"
else
    echo -e "\033[33mNo secrets synced. Run bootstrap first.\033[0m"
fi
echo -e "\033[90mThese secrets are used by terraform-deploy and firebase-hosting workflows.\033[0m"
