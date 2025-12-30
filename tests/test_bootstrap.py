import os
import shutil
from unittest.mock import patch, MagicMock
from app.core.config import Settings
from app.core.bootstrap import bootstrap_database

def test_bootstrap_db_exists(tmp_path):
    """If DB exists, do nothing"""
    db_file = tmp_path / "app.db"
    db_file.touch()
    
    settings = Settings(SQLITE_PATH=str(db_file), GCS_DB_BUCKET="bucket", GCS_DB_OBJECT="obj")
    
    with patch("app.core.bootstrap.storage") as mock_storage:
         bootstrap_database(settings)
         mock_storage.Client.assert_not_called()

def test_bootstrap_download(tmp_path):
    """If DB missing and config set, download"""
    db_file = tmp_path / "custom/app.db" # Deep path
    settings = Settings(SQLITE_PATH=str(db_file), GCS_DB_BUCKET="bucket", GCS_DB_OBJECT="obj")
    
    # Patch storage at the module level where it is used in bootstrap_database
    with patch("app.core.bootstrap.storage") as mock_storage:
        mock_client_cls = mock_storage.Client
        mock_client = mock_client_cls.return_value
        mock_bucket = mock_client.bucket.return_value
        mock_blob = mock_bucket.blob.return_value
        
        # Call function
        bootstrap_database(settings)
        
        # Verify
        mock_client_cls.assert_called_once()
        mock_client.bucket.assert_called_with("bucket")
        mock_bucket.blob.assert_called_with("obj")
        mock_blob.download_to_filename.assert_called_with(str(db_file))
        
        # Check directory creation
        assert os.path.isdir(tmp_path / "custom")

def test_bootstrap_no_config(tmp_path):
    """If DB missing and config missing, do nothing"""
    db_file = tmp_path / "app.db"
    settings = Settings(SQLITE_PATH=str(db_file), GCS_DB_BUCKET=None, GCS_DB_OBJECT=None)
    
    with patch("app.core.bootstrap.storage") as mock_storage:
         bootstrap_database(settings)
         mock_storage.Client.assert_not_called()
