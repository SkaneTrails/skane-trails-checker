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
# Usage: .\sync-secrets.ps1 [-Repo owner/repo]

param(
    [string]$Repo
)

$ErrorActionPreference = "Stop"
$envDir = Join-Path $PSScriptRoot ".."
$accessDir = Join-Path $envDir "access"
$tfvarsPath = Join-Path $envDir "terraform.tfvars"
$backendPath = Join-Path $envDir "backend.tf"

# Detect repo from git remote if not provided
if (-not $Repo) {
    $remoteUrl = git remote get-url origin 2>$null
    if ($remoteUrl -match '[:/]([^/]+/[^/.]+?)(\.git)?$') {
        $Repo = $Matches[1]
    } else {
        Write-Host "Error: Could not detect repository. Pass -Repo owner/name" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Syncing secrets to GitHub repository" -ForegroundColor Cyan
Write-Host "Repository: $Repo" -ForegroundColor Gray
Write-Host ""

# Verify prerequisites
try {
    gh auth status 2>&1 | Out-Null
} catch {
    Write-Host "Error: gh CLI not authenticated. Run 'gh auth login' first." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "Error: gcloud CLI not found. Install Google Cloud SDK first." -ForegroundColor Red
    exit 1
}

# Helper: read file, strip comments and blank lines
function Get-CleanContent {
    param([string]$FilePath)
    if (-not (Test-Path $FilePath)) { return "" }
    $lines = Get-Content $FilePath |
        Where-Object { $_.Trim() -ne "" -and -not $_.TrimStart().StartsWith("#") } |
        ForEach-Object { $_.Trim() }
    return ($lines -join "`n")
}

# Helper: extract value from terraform.tfvars (key = "value")
function Get-TfVar {
    param([string]$Key)
    $line = Get-Content $tfvarsPath |
        Where-Object {
            $_.Trim() -ne "" -and
            -not $_.TrimStart().StartsWith("#") -and
            $_ -match "^\s*$Key\s*="
        } | Select-Object -First 1
    if ($line -and $line -match '"([^"]+)"') {
        return $Matches[1]
    }
    return $null
}

$synced = 0
$errors = 0

# --- terraform.tfvars ---
if (-not (Test-Path $tfvarsPath)) {
    Write-Host "Error: terraform.tfvars not found at $tfvarsPath" -ForegroundColor Red
    Write-Host "  Run bootstrap first. See infra/environments/dev/init/README.md" -ForegroundColor Red
    exit 1
}

# 1. GCP_PROJECT_ID
$projectId = Get-TfVar "project"
if ($projectId) {
    gh secret set GCP_PROJECT_ID --repo $Repo --body $projectId
    Write-Host "  GCP_PROJECT_ID = $projectId" -ForegroundColor Green
    $synced++
} else {
    Write-Host "  Error: Could not extract 'project' from terraform.tfvars" -ForegroundColor Red
    $errors++
}

# 2. GCP_PROJECT_NUMBER (fetched from GCP)
if ($projectId) {
    Write-Host "  Fetching project number from GCP..." -ForegroundColor Gray
    $projectNumber = gcloud projects describe $projectId --format="value(projectNumber)" 2>$null
    if ($projectNumber) {
        gh secret set GCP_PROJECT_NUMBER --repo $Repo --body $projectNumber.Trim()
        Write-Host "  GCP_PROJECT_NUMBER = $($projectNumber.Trim())" -ForegroundColor Green
        $synced++
    } else {
        Write-Host "  Error: Could not fetch project number. Check gcloud auth." -ForegroundColor Red
        $errors++
    }
}

# 3. GCP_REGION
$region = Get-TfVar "region"
if ($region) {
    gh secret set GCP_REGION --repo $Repo --body $region
    Write-Host "  GCP_REGION = $region" -ForegroundColor Green
    $synced++
} else {
    Write-Host "  Error: Could not extract 'region' from terraform.tfvars" -ForegroundColor Red
    $errors++
}

# 4. TF_VARS_FILE (entire tfvars content)
$tmpFile = [System.IO.Path]::GetTempFileName()
try {
    Copy-Item $tfvarsPath $tmpFile
    gh secret set TF_VARS_FILE --repo $Repo --body (Get-Content $tmpFile -Raw)
    Write-Host "  TF_VARS_FILE (terraform.tfvars content)" -ForegroundColor Green
    $synced++
} finally {
    Remove-Item $tmpFile -ErrorAction SilentlyContinue
}

# --- backend.tf ---
if (Test-Path $backendPath) {
    $backendContent = Get-Content $backendPath -Raw

    # 5. TF_BACKEND_BUCKET
    if ($backendContent -match 'bucket\s*=\s*"([^"]+)"') {
        $bucket = $Matches[1]
        gh secret set TF_BACKEND_BUCKET --repo $Repo --body $bucket
        Write-Host "  TF_BACKEND_BUCKET = $bucket" -ForegroundColor Green
        $synced++
    } else {
        Write-Host "  Error: Could not extract bucket from backend.tf" -ForegroundColor Red
        $errors++
    }

    # 6. TF_BACKEND_PREFIX
    if ($backendContent -match 'prefix\s*=\s*"([^"]+)"') {
        $prefix = $Matches[1]
        gh secret set TF_BACKEND_PREFIX --repo $Repo --body $prefix
        Write-Host "  TF_BACKEND_PREFIX = $prefix" -ForegroundColor Green
        $synced++
    } else {
        Write-Host "  Error: Could not extract prefix from backend.tf" -ForegroundColor Red
        $errors++
    }
} else {
    Write-Host "  Skipping backend.tf (not found)" -ForegroundColor Yellow
}

# --- access/superusers.txt ---
# 7. TF_SUPERUSERS
$suPath = Join-Path $accessDir "superusers.txt"
$suContent = Get-CleanContent -FilePath $suPath
if ($suContent -ne "") {
    $count = ($suContent -split "`n").Count
    $tmpFile = [System.IO.Path]::GetTempFileName()
    try {
        Set-Content -Path $tmpFile -Value $suContent -NoNewline
        gh secret set TF_SUPERUSERS --repo $Repo --body (Get-Content $tmpFile -Raw)
        Write-Host "  TF_SUPERUSERS ($count email(s))" -ForegroundColor Green
        $synced++
    } finally {
        Remove-Item $tmpFile -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "  Skipping superusers.txt (empty or not found)" -ForegroundColor Yellow
}

# --- Summary ---
Write-Host ""
if ($errors -gt 0) {
    Write-Host "Synced $synced secret(s) with $errors error(s)" -ForegroundColor Red
    exit 1
} elseif ($synced -gt 0) {
    Write-Host "Synced $synced secret(s) to GitHub" -ForegroundColor Green
} else {
    Write-Host "No secrets synced. Run bootstrap first." -ForegroundColor Yellow
}
Write-Host "These secrets are used by terraform-deploy and firebase-hosting workflows." -ForegroundColor Gray
