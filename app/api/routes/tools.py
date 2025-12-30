import subprocess
import tempfile
import os
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter()

@router.post("/text-extraction")
async def extract_text(file: UploadFile = File(...)):
    # Check extension
    if not file.filename.lower().endswith('.doc'):
        raise HTTPException(status_code=400, detail="Only .doc files are supported by this endpoint")

    try:
        # Save to temp file because textutil works on files
        with tempfile.NamedTemporaryFile(delete=False, suffix=".doc") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Run textutil
        # textutil -convert txt -stdout /path/to/file.doc
        result = subprocess.run(
            ["textutil", "-convert", "txt", "-stdout", tmp_path],
            capture_output=True,
            text=True
        )

        # Clean up
        os.remove(tmp_path)

        if result.returncode != 0:
            raise Exception(f"textutil failed: {result.stderr}")

        return {"text": result.stdout}

    except Exception as e:
        # Ensure cleanup in case of error
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=str(e))
