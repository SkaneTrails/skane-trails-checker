# Track Status Directory

This directory contains CSV files that store the completion status of trails.

## Files

- `track_skaneleden_status.csv` - Status for official Skåneleden trails

## Format

```csv
track_id,status,last_updated
1,To Explore,2024-01-15
2,Explored!,2024-02-20
```

## Data Privacy

This directory is excluded from version control (see `.gitignore`).
Your personal tracking data remains private.

## Note

When migrating to cloud deployment, these CSV files will be replaced
with Firestore collections.
