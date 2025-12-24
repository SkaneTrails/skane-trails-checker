"""Delete all trails from Firestore."""

import sys
from pathlib import Path

# Add app directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "app"))

from functions.env_loader import load_env_if_needed
from functions.firestore_client import get_firestore_client

# Load environment variables
load_env_if_needed()

def delete_all_trails() -> None:
    """Delete all documents from trails collection."""
    db = get_firestore_client()
    collection = db.collection("trails")

    print("[Firestore] Fetching all trails...")
    docs = collection.stream()

    count = 0
    for doc in docs:
        print(f"[Firestore] Deleting trail: {doc.id}")
        doc.reference.delete()
        count += 1

    print(f"[Firestore] Deleted {count} trails")

    # Also delete trail_details if any
    details_collection = db.collection("trail_details")
    print("[Firestore] Fetching all trail details...")
    details_docs = details_collection.stream()

    details_count = 0
    for doc in details_docs:
        print(f"[Firestore] Deleting trail details: {doc.id}")
        doc.reference.delete()
        details_count += 1

    print(f"[Firestore] Deleted {details_count} trail details")
    print(f"[Firestore] Total deleted: {count + details_count} documents")

if __name__ == "__main__":
    print("=" * 60)
    print("WARNING: This will delete ALL trails from Firestore!")
    print("=" * 60)
    print("Collections to be deleted:")
    print("  - trails (all trail data)")
    print("  - trail_details (all detail data)")
    print()

    response = input("Are you sure you want to continue? (yes/no): ").strip().lower()

    if response in ("yes", "y"):
        print("\nProceeding with deletion...")
        delete_all_trails()
    else:
        print("\nDeletion cancelled.")
