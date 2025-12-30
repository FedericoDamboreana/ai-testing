import os
import logging
from app.core.config import Settings
try:
    from google.cloud import storage
except ImportError:
    storage = None

logger = logging.getLogger("uvicorn")

def bootstrap_database(settings: Settings) -> None:
    """
    Downloads the SQLite database from GCS if it doesn't verify exist locally.
    Only runs if GCS_DB_BUCKET and GCS_DB_OBJECT are configured.
    """
    if not settings.SQLITE_PATH:
        # If no custom path is set, we assume local dev or non-persistent setup
        # But technically we could still bootstrap to ./data/app.db if defined.
        # For now, let's only bootstrap if SQLITE_PATH is explicit, 
        # as that implies a mounted volume or specific intention.
        return

    db_path = settings.SQLITE_PATH
    
    # Check if DB already exists
    if os.path.exists(db_path):
        logger.info(f"Database found at {db_path}. Skipping bootstrap.")
        return

    # Check GCS config
    if not settings.GCS_DB_BUCKET or not settings.GCS_DB_OBJECT:
        logger.warning(f"Database not found at {db_path} and GCS config missing. Starting with empty DB.")
        return

    logger.info(f"Database not found at {db_path}. Attempting download from gs://{settings.GCS_DB_BUCKET}/{settings.GCS_DB_OBJECT}...")

    try:
        if storage is None:
            logger.error("google-cloud-storage not installed. Cannot bootstrap from GCS.")
            return

        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        storage_client = storage.Client()
        bucket = storage_client.bucket(settings.GCS_DB_BUCKET)
        blob = bucket.blob(settings.GCS_DB_OBJECT)
        
        blob.download_to_filename(db_path)
        logger.info(f"Successfully downloaded database to {db_path}.")
        
    except Exception as e:
        logger.error(f"Failed to download database from GCS: {e}")
        logger.warning("Application will start with a fresh/empty database if creation succeeds.")
