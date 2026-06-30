"""Delete all planned_hikes trails from Firestore to allow re-bootstrap."""

import sys
from pathlib import Path

# Add parent directory to path for imports
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))

from api.storage.firestore_client import get_collection  # noqa: E402
from app.functions.env_loader import load_env_if_needed  # noqa: E402

# Load environment variables
load_env_if_needed()


def delete_planned_trails() -> None:
    """Delete all trails with source='planned_hikes' from Firestore."""
    print("Deleting all planned_hikes trails from Firestore...")

    collection = get_collection("trails")

    # Get all planned trails
    planned_trails = collection.where("source", "==", "planned_hikes").stream()

    deleted_count = 0
    for trail_doc in planned_trails:
        trail_doc.reference.delete()
        deleted_count += 1
        if deleted_count % 10 == 0:
            print(f"  Deleted {deleted_count} trails...")

    print(f"\n✓ Deleted {deleted_count} planned_hikes trails from Firestore")
    print(
        "\nNext step: Re-seed planned trails by running the app"
        " (calls bootstrap_planned_trails from app.functions.bootstrap_trails)."
    )


if __name__ == "__main__":
    delete_planned_trails()
