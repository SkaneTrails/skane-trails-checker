"""Quick script to check Firestore trails data."""
import sys
from pathlib import Path

# Add app directory to path for imports
sys.path.insert(0, str(Path(__file__).parent / "app"))

from functions.env_loader import load_env_if_needed
from functions.trail_storage import get_all_trails

# Load environment variables
load_env_if_needed()

# Get all trails
trails = get_all_trails()

print(f"Total trails in Firestore: {len(trails)}")
print("\nTrail details:")
for trail in trails:
    name = trail.name
    status = trail.status
    source = trail.source
    updated = trail.last_updated
    
    print(f"  ID: {trail.trail_id}")
    print(f"    Name: {name}")
    print(f"    Status: {status}")
    print(f"    Source: {source}")
    print(f"    Updated: {updated}")
    print()
