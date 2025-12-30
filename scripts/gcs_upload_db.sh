#!/bin/bash

# Script to upload the local SQLite database to Google Cloud Storage
# Usage: ./scripts/gcs_upload_db.sh <bucket_name> [db_path] [gcs_object_path]

BUCKET_NAME=$1
DB_PATH=${2:-"./test.db"} # Default to ./test.db as that's often the local default
OBJECT_PATH=${3:-"app.db"}

if [ -z "$BUCKET_NAME" ]; then
    echo "Usage: $0 <bucket_name> [db_path] [gcs_object_path]"
    exit 1
fi

if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database file not found at $DB_PATH"
    exit 1
fi

echo "Uploading $DB_PATH to gs://$BUCKET_NAME/$OBJECT_PATH..."
gsutil cp "$DB_PATH" "gs://$BUCKET_NAME/$OBJECT_PATH"

if [ $? -eq 0 ]; then
    echo "Upload successful."
    echo "Configure Cloud Run with:"
    echo "GCS_DB_BUCKET=$BUCKET_NAME"
    echo "GCS_DB_OBJECT=$OBJECT_PATH"
else
    echo "Upload failed."
    exit 1
fi
