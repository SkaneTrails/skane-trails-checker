"""
Setup script to fetch Firestore connection details from GCP Secret Manager
and populate .env file for local development.

Usage:
    uv run python dev-tools/setup_env.py           # Normal run
    uv run python dev-tools/setup_env.py --force   # Force refresh
    uv run python dev-tools/setup_env.py --check   # Validate .env
    uv run python dev-tools/setup_env.py --list    # Show mappings

Requirements:
    - gcloud CLI authenticated: gcloud auth application-default login
    - IAM role: roles/secretmanager.secretAccessor
    - Dependencies: uv pip install -r dev-tools/requirements.txt
"""

import argparse
import shutil
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

try:
    import yaml
    from dotenv import dotenv_values
    from google.cloud import secretmanager
except ImportError as e:
    print(f"❌ Missing dependency: {e}")
    print("\n💡 Install dependencies:")
    print("   uv pip install -r dev-tools/requirements.txt")
    sys.exit(1)

# Constants
REPO_ROOT = Path(__file__).parent.parent
ENV_FILE = REPO_ROOT / ".env"
MAPPINGS_FILE = Path(__file__).parent / "secret_mappings.yaml"
FRESHNESS_HOURS = 24  # Consider .env stale after 24 hours


class Colors:
    """ANSI color codes for terminal output."""

    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BLUE = "\033[94m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def load_mappings(env: str) -> dict[str, str]:
    """Load secret name to env var mappings from YAML file."""
    if not MAPPINGS_FILE.exists():
        print(f"{Colors.RED}❌ Mappings file not found: {MAPPINGS_FILE}{Colors.RESET}")
        sys.exit(1)

    with MAPPINGS_FILE.open() as f:
        mappings = yaml.safe_load(f)

    if env not in mappings:
        print(f"{Colors.RED}❌ Environment '{env}' not found in {MAPPINGS_FILE}{Colors.RESET}")
        print(f"Available environments: {', '.join(mappings.keys())}")
        sys.exit(1)

    return mappings[env]


def get_current_env() -> str:
    """
    Determine current environment from .env file or default to 'dev'.

    Returns environment name (e.g., 'dev', 'prod')
    """
    if ENV_FILE.exists():
        env_vars = dotenv_values(ENV_FILE)
        return env_vars.get("ENV", "dev")
    return "dev"


def is_env_fresh() -> bool:
    """Check if .env file exists and was modified within freshness window."""
    if not ENV_FILE.exists():
        return False

    modified_time = datetime.fromtimestamp(ENV_FILE.stat().st_mtime, tz=UTC)
    age = datetime.now(UTC) - modified_time
    return age < timedelta(hours=FRESHNESS_HOURS)


def get_gcp_project() -> str:
    """Get GCP project ID from gcloud config."""
    import subprocess

    # Find gcloud executable (cross-platform)
    gcloud_path = shutil.which("gcloud")
    if not gcloud_path:
        print(f"{Colors.RED}❌ gcloud CLI not found in PATH{Colors.RESET}")
        print("\n💡 Install gcloud: https://cloud.google.com/sdk/docs/install")
        print("   After installation, restart your terminal or IDE")
        sys.exit(1)

    try:
        result = subprocess.run(  # noqa: S603
            [gcloud_path, "config", "get-value", "project"], capture_output=True, text=True, check=True
        )
        project = result.stdout.strip()
        if not project:
            print(f"{Colors.RED}❌ No GCP project set in gcloud config{Colors.RESET}")
            print("\n💡 Set project with:")
            print("   gcloud config set project YOUR_PROJECT_ID")
            sys.exit(1)
        return project
    except subprocess.CalledProcessError:
        print(f"{Colors.RED}❌ Failed to get GCP project from gcloud{Colors.RESET}")
        print("\n💡 Authenticate with:")
        print("   gcloud auth application-default login")
        sys.exit(1)


def fetch_secret(client: secretmanager.SecretManagerServiceClient, project: str, secret_name: str) -> str:
    """Fetch latest version of a secret from Secret Manager."""
    name = f"projects/{project}/secrets/{secret_name}/versions/latest"
    try:
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")
    except Exception as e:
        print(f"{Colors.RED}❌ Failed to fetch secret '{secret_name}': {e}{Colors.RESET}")
        print("\n💡 Troubleshooting:")
        print("   1. Verify secret exists: gcloud secrets list")
        print("   2. Check permissions: gcloud projects get-iam-policy YOUR_PROJECT")
        print("   3. Ensure Secret Manager API is enabled")
        raise


def fetch_all_secrets(mappings: dict[str, str], project: str) -> dict[str, str]:
    """Fetch all secrets defined in mappings."""
    print(f"\n{Colors.BLUE}📡 Fetching secrets from GCP Secret Manager...{Colors.RESET}")

    try:
        client = secretmanager.SecretManagerServiceClient()
    except Exception as e:
        print(f"{Colors.RED}❌ Failed to create Secret Manager client: {e}{Colors.RESET}")
        print("\n💡 Authenticate with:")
        print("   gcloud auth application-default login")
        sys.exit(1)

    env_vars = {}
    for secret_name, env_var_name in mappings.items():
        try:
            print(f"  Fetching {Colors.BOLD}{secret_name}{Colors.RESET} → {env_var_name}...", end=" ")
            value = fetch_secret(client, project, secret_name)
            env_vars[env_var_name] = value
            print(f"{Colors.GREEN}✓{Colors.RESET}")
        except Exception:
            print(f"{Colors.RED}✗{Colors.RESET}")
            sys.exit(1)

    return env_vars


def write_env_file(env_vars: dict[str, str], env: str) -> None:
    """Write environment variables to .env file."""
    print(f"\n{Colors.BLUE}📝 Writing to {ENV_FILE}...{Colors.RESET}")

    # Always include ENV variable to track current environment
    env_vars["ENV"] = env

    # Local dev defaults — not secrets, just config for running locally
    if env == "dev":
        local_defaults = {
            "SKIP_AUTH": "true",
            "ALLOWED_ORIGINS": "http://localhost:8081,http://localhost:8085,http://localhost:19006,http://localhost:3000",
        }
        for key, value in local_defaults.items():
            env_vars.setdefault(key, value)

    # Sort for consistent output
    sorted_vars = sorted(env_vars.items())

    # Write with header
    with ENV_FILE.open("w") as f:
        f.write("# Auto-generated by dev-tools/setup_env.py\n")
        f.write(f"# Generated: {datetime.now(UTC).isoformat()}\n")
        f.write(f"# Environment: {env}\n")
        f.write("# DO NOT COMMIT THIS FILE\n\n")

        f.writelines(f"{key}={value}\n" for key, value in sorted_vars)

    # Set restrictive permissions (600 = rw-------)
    ENV_FILE.chmod(0o600)

    print(f"{Colors.GREEN}✅ Successfully created {ENV_FILE}{Colors.RESET}")
    print("   File permissions: 600 (owner read/write only)")


def check_env_file(mappings: dict[str, str]) -> None:
    """Validate that .env file has all required variables."""
    print(f"\n{Colors.BLUE}🔍 Checking {ENV_FILE}...{Colors.RESET}")

    if not ENV_FILE.exists():
        print(f"{Colors.RED}❌ .env file not found{Colors.RESET}")
        print("\n💡 Run without --check to create it:")
        print("   uv run python dev-tools/setup_env.py")
        sys.exit(1)

    env_vars = dotenv_values(ENV_FILE)
    required_vars = set(mappings.values())
    found_vars = set(env_vars.keys())

    missing = required_vars - found_vars
    if missing:
        print(f"{Colors.RED}❌ Missing variables: {', '.join(missing)}{Colors.RESET}")
        print("\n💡 Refresh .env file:")
        print("   uv run python dev-tools/setup_env.py --force")
        sys.exit(1)

    # Check for empty values
    empty = [k for k, v in env_vars.items() if k in required_vars and not v]
    if empty:
        print(f"{Colors.YELLOW}⚠️  Empty variables: {', '.join(empty)}{Colors.RESET}")
        print("\n💡 Refresh .env file:")
        print("   uv run python dev-tools/setup_env.py --force")
        sys.exit(1)

    print(f"{Colors.GREEN}✅ All required variables present and non-empty{Colors.RESET}")

    # Show age
    modified_time = datetime.fromtimestamp(ENV_FILE.stat().st_mtime, tz=UTC)
    age = datetime.now(UTC) - modified_time
    age_str = f"{age.days} days" if age.days > 0 else f"{age.seconds // 3600} hours"
    print(f"   File age: {age_str}")

    if not is_env_fresh():
        print(f"{Colors.YELLOW}⚠️  File is older than {FRESHNESS_HOURS} hours - consider refreshing{Colors.RESET}")
        print("   uv run python dev-tools/setup_env.py --force")


def list_mappings(mappings: dict[str, str], env: str) -> None:
    """Display secret to env var mappings."""
    print(f"\n{Colors.BLUE}📋 Secret mappings for environment: {Colors.BOLD}{env}{Colors.RESET}")
    print(f"\n{'Secret Name':<35} → {'Environment Variable':<25}")
    print("-" * 65)
    for secret_name, env_var_name in sorted(mappings.items()):
        print(f"{secret_name:<35} → {env_var_name:<25}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch Firestore secrets from GCP Secret Manager into .env file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  uv run python dev-tools/setup_env.py           # Create/update .env
  uv run python dev-tools/setup_env.py --force   # Force refresh
  uv run python dev-tools/setup_env.py --check   # Validate .env
  uv run python dev-tools/setup_env.py --list    # Show mappings
        """,
    )
    parser.add_argument("--force", action="store_true", help="Force refresh even if .env is fresh")
    parser.add_argument("--check", action="store_true", help="Check if .env has all required variables")
    parser.add_argument("--list", action="store_true", help="List secret to env var mappings")
    args = parser.parse_args()

    # Determine environment
    env = get_current_env()

    # Load mappings
    mappings = load_mappings(env)

    # Handle --list flag
    if args.list:
        list_mappings(mappings, env)
        return

    # Handle --check flag
    if args.check:
        check_env_file(mappings)
        return

    # Check freshness
    if ENV_FILE.exists() and not args.force:
        if is_env_fresh():
            print(f"{Colors.GREEN}✅ .env file is fresh (< {FRESHNESS_HOURS} hours old){Colors.RESET}")
            print(f"   Located at: {ENV_FILE}")
            print("\n💡 To force refresh:")
            print("   uv run python dev-tools/setup_env.py --force")
            return
        print(f"{Colors.YELLOW}⚠️  .env file is stale (> {FRESHNESS_HOURS} hours old){Colors.RESET}")
        print("   Refreshing...")

    # Get GCP project
    project = get_gcp_project()
    print(f"{Colors.BLUE}🔧 Using GCP project: {Colors.BOLD}{project}{Colors.RESET}")

    # Fetch secrets
    env_vars = fetch_all_secrets(mappings, project)

    # Write .env file
    write_env_file(env_vars, env)

    # Success message
    print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 Setup complete!{Colors.RESET}")
    print("\n📋 Next steps:")
    print("   1. Start the API: uv run uvicorn api.main:app --reload --port 8000")
    print("   2. Verify connection: Visit http://localhost:8000/health")
    print("\n💡 Useful commands:")
    print("   Check .env:  uv run python dev-tools/setup_env.py --check")
    print("   Refresh:     uv run python dev-tools/setup_env.py --force")


if __name__ == "__main__":
    main()
