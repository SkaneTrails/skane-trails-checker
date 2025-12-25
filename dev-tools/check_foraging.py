"""Quick script to check Firestore foraging data."""

from app.functions.env_loader import load_env_if_needed
from app.functions.foraging_storage import get_all_foraging_spots

# Load environment variables
load_env_if_needed()

# Get all foraging spots
all_spots = get_all_foraging_spots()

print(f"Total foraging spots in Firestore: {sum(len(spots) for spots in all_spots.values())}")
print("\nForaging spots by month:")
for month, spots in sorted(all_spots.items()):
    print(f"  {month}: {len(spots)} spots")
    for spot in spots[:3]:  # Show first 3
        print(f"    - {spot.type} at ({spot.lat:.4f}, {spot.lng:.4f})")
