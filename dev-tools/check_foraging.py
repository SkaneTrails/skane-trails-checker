"""Quick script to check Firestore foraging data."""

import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from api.storage.foraging_storage import get_foraging_spots, get_foraging_types
from app.functions.env_loader import load_env_if_needed

# Load environment variables
load_env_if_needed()

# Get all foraging types
all_types = get_foraging_types()
print(f"Foraging types in Firestore: {len(all_types)}")
for ft in all_types:
    print(f"  {ft.icon} {ft.name} ({ft.color})")

# Get all foraging spots
all_spots = get_foraging_spots()
print(f"\nTotal foraging spots in Firestore: {len(all_spots)}")

# Group by month
spots_by_month: dict[str, list] = defaultdict(list)
for spot in all_spots:
    spots_by_month[spot.month].append(spot)

print("\nForaging spots by month:")
for month, spots in sorted(spots_by_month.items()):
    print(f"  {month}: {len(spots)} spots")
    for spot in spots[:3]:  # Show first 3
        print(f"    - {spot.type} at ({spot.lat:.4f}, {spot.lng:.4f})")
