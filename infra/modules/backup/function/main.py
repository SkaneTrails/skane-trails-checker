"""Cloud Function to export Firestore database to Cloud Storage.

This function is triggered by Cloud Scheduler to perform weekly backups.
It uses the Firestore Admin REST API to export all collections to a Cloud Storage bucket.
Supports backing up multiple databases in a single invocation.
"""

import os
from datetime import UTC, datetime
from typing import Any

import functions_framework
import google.auth
from googleapiclient import discovery


@functions_framework.http
def backup_firestore(_request: Any) -> tuple[dict[str, Any], int]:
    """Export Firestore databases to Cloud Storage.

    Triggered by Cloud Scheduler via HTTP POST.
    Backs up all databases specified in DATABASE_NAMES (comma-separated).

    Environment variables required:
        PROJECT_ID: GCP project ID
        DATABASE_NAMES: Comma-separated list of Firestore database names
        BUCKET_NAME: Cloud Storage bucket for backups

    Returns:
        Tuple of (response_body, status_code)
    """
    project_id = os.environ.get("PROJECT_ID")
    database_names_str = os.environ.get("DATABASE_NAMES")
    bucket_name = os.environ.get("BUCKET_NAME")

    if not all([project_id, database_names_str, bucket_name]):
        return {"error": "Missing required environment variables"}, 500

    # Parse comma-separated database names
    database_names = [name.strip() for name in database_names_str.split(",") if name.strip()]

    if not database_names:
        return {"error": "No database names provided"}, 400

    # Create timestamped backup folder
    timestamp = datetime.now(UTC).strftime("%Y-%m-%d-%H%M%S")

    # Initialize Firestore Admin API client
    credentials, _ = google.auth.default()
    service = discovery.build("firestore", "v1", credentials=credentials)

    results = []

    for database_name in database_names:
        output_uri = f"gs://{bucket_name}/{timestamp}/{database_name}"

        # Build the database resource name
        database_path = f"projects/{project_id}/databases/{database_name}"

        # Create export request body
        export_body = {
            "outputUriPrefix": output_uri,
            # Empty collectionIds means export all collections
            "collectionIds": [],
        }

        # Start the export operation (async - returns immediately)
        operation = service.projects().databases().exportDocuments(name=database_path, body=export_body).execute()

        results.append({"database": database_name, "operation": operation.get("name"), "output_uri": output_uri})

    return {"status": "started", "timestamp": timestamp, "databases": results}, 200
