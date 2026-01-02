# Deployment Guide (Google Cloud Run)

This document describes the architecture and deployment process for the LLM Evaluation Tool on Google Cloud Run.

## 1. High-Level Architecture

The application is designed to run as a **stateful singleton** on a serverless platform.

-   **Platform**: Google Cloud Run (Fully Managed).
-   **Compute**: Single container instance (min_instances=1, max_instances=1).
-   **Database**: SQLite (`app.db`).
    -   Chosen for simplicity and to keep the entire app self-contained without managing a separate Cloud SQL instance.
    -   **Critical**: Persistence is achieved by mounting a Google Cloud Storage bucket (via Cloud Storage FUSE) or a Network File System (Filestore) to `/data` inside the container.
-   **Scaling**: vertical scaling only. **Horizontal scaling is NOT supported** because SQLite does not support concurrent writes from multiple instances (and the FUSE mount does not support locking reliably).

## 2. Docker Setup

The application is containerized using `Dockerfile`.

-   **Base Image**: `python:3.11-slim` (Official Python image).
-   **Port Binding**: The container listens on `0.0.0.0:$PORT` (the `PORT` env var is injected by Cloud Run, typically 8080).
-   **Frontend**:
    -   Built in a multi-stage Docker process (`frontend-builder`).
    -   Vite build output (`dist/`) is copied to the final image.
    -   Served by FastAPI as static files (`/assets`, `/index.html`).
-   **Installation**:
    -   We do **NOT** install the application as a Python wheel (`pip install .` is avoided).
    -   We use `requirements.txt` generated from `pyproject.toml`.
    -   Dependencies are installed globally in the container.
    -   `PYTHONPATH` is set to `/app` to allow absolute imports (`from app.core...`).
    -   Startup command: `uvicorn app.main:app --host 0.0.0.0 --port ${PORT}`.

### Local Development w/ Docker

```bash
# Build locally
docker build -t llm-eval:local .

# Run locally (mimicking Cloud Run port)
docker run -p 8080:8080 -e PORT=8080 -e OPENAI_API_KEY=sk-... llm-eval:local
```

## 3. Platform Architecture (Important)

Cloud Run runs on Linux. The content must be compiled for **linux/amd64**.

> [!WARNING]
> If you build this image on an Apple Silicon (M1/M2/M3) Mac using standard `docker build`, it will create an `linux/arm64` image. **This will fail to start on Cloud Run** with an "Exec format error".

You **MUST** cross-compile for `linux/amd64`.

```bash
docker buildx build --platform linux/amd64 -t [IMAGE_TAG] .
```

## 4. Google Cloud Setup

### Prerequisites
Ensure the following APIs are enabled:
-   Cloud Run Admin API
-   Artifact Registry API
-   Secret Manager API

### 1. Artifact Registry
Create a Docker repository in your region (e.g., `us-central1`):
```bash
gcloud artifacts repositories create llm-eval-tracker \
    --repository-format=docker \
    --location=us-central1 \
    --description="Docker repository for LLM Eval Tool"
```

### 2. Build and Push
Tag and push the image. Replace `PROJECT_ID` with your GCP project ID.

```bash
export PROJECT_ID=$(gcloud config get-value project)
export REPO="us-central1-docker.pkg.dev/$PROJECT_ID/llm-eval-tracker/app"
export TAG="0.1.0"

# Build for AMD64
docker buildx build --platform linux/amd64 -t $REPO:$TAG --push .
```

### 3. Deploy to Cloud Run
Deploy the service using the pushed image. The following command sets up the basics, but **persistence requires a mounted volume configuration (not shown in simple command)**.

```bash
gcloud run deploy llm-eval-tracker \
    --image $REPO:$TAG \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 8080 \
    --min-instances 1 \
    --max-instances 1
```

*Note: For SQLite persistence, you must add volume mounts via the Cloud Console or YAML configuration.*

## 5. Environment Variables

The application requires the following environment variables at runtime:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `LLM_MODE` | Usage mode for the LLM provider. | `openai` (Production) or `stub` (Dev) |
| `OPENAI_MODEL` | The model identifier to use. | `gpt-4o` |
| `SQLITE_PATH` | Absolute path to the SQLite database file. | `/data/app.db` |
| `PORT` | Port to listen on (injected by Cloud Run). | `8080` |
| `OPENAI_API_KEY` | **Sensitive**. Must be loaded from Secret Manager. | `projects/.../secrets/...` |

## 6. Secret Management

We do not bake the `OPENAI_API_KEY` into the image or environment variable literals. We use **Google Secret Manager**.

1.  **Create Secret**:
    ```bash
    echo -n "sk-..." | gcloud secrets create OPENAI_API_KEY --data-file=-
    ```
2.  **Grant Access**:
    Ensure the Cloud Run Service Account (usually `PROJECT_NUMBER-compute@developer.gserviceaccount.com`) has the role **Secret Manager Secret Accessor** (`roles/secretmanager.secretAccessor`).
3.  **Deploy with Secret**:
    ```bash
    gcloud run services update llm-eval-tracker \
        --set-secrets OPENAI_API_KEY=OPENAI_API_KEY:latest
    ```

## 7. Database Bootstrap (GCS)

To seed the production database from a local copy:

1.  **Create Bucket**:
    ```bash
    gsutil mb -l us-central1 gs://[YOUR_BUCKET_NAME]
    ```
2.  **Upload Local DB**:
    ```bash
    ./scripts/gcs_upload_db.sh [YOUR_BUCKET_NAME] ./test.db app.db
    # Or manually: gsutil cp ./test.db gs://[YOUR_BUCKET_NAME]/app.db
    ```
3.  **Configure Cloud Run**:
    Add the following environment variables:
    *   `GCS_DB_BUCKET`: `[YOUR_BUCKET_NAME]`
    *   `GCS_DB_OBJECT`: `app.db`
    *   `SQLITE_PATH`: `/data/app.db` (Ensure persistence volume is mounted)
4.  **Permissions**:
    Ensure the Cloud Run Service Account has `roles/storage.objectViewer` on the bucket.

## 8. Updating Configuration (CRITICAL WARNING)

> [!CAUTION]
> When updating environment variables using `gcloud run services update --set-env-vars`, it REPLACES the existing variables unless you specify all of them. This can accidentally remove `SQLITE_PATH`, causing data loss (app reverts to ephemeral storage).

**ALWAYS use `--update-env-vars` instead of `--set-env-vars` to preserve existing variables.**

**Safe Update Example:**
```bash
gcloud run services update llm-eval-tracker \
    --update-env-vars=OPENAI_MODEL=gpt-5 \
    --region us-central1
```

If you must reset variables, ensure you include `SQLITE_PATH=/data/app.db` in your command.

### Container fails to start
*   **Symptom**: "Exec format error" in logs.
    *   **Cause**: You built the image on Mac M1/M2 without `--platform linux/amd64`.
    *   **Fix**: Rebuild using `docker buildx build --platform linux/amd64`.
*   **Symptom**: "ModuleNotFoundError".
    *   **Cause**: `PYTHONPATH` not set or `requirements.txt` missing dependencies.
    *   **Fix**: Ensure `ENV PYTHONPATH=/app` is in Dockerfile.

### Application runs but LLM fails
*   **Symptom**: 500 error on evaluation.
    *   **Cause**: `OPENAI_API_KEY` is missing or invalid.
    *   **Fix**: Check if the Secret is mounted correctly in the Cloud Run "Variables & Secrets" tab.

### Database resets on deploy
*   **Symptom**: All data is lost after a new deployment.
    *   **Cause**: You are writing to local container filesystem, which is ephemeral.
    *   **Fix**: You must mount a persistent volume (GCS FUSE or Filestore) to `/data` and set `SQLITE_PATH=/data/app.db`.

### Log Analysis
View logs via:
```bash
gcloud run services logs read llm-eval-tracker --limit 50
```

### Health Check
Verify the service is up:
```bash
curl https://[YOUR-SERVICE-URL]/health
# Expected: {"status": "ok"}
```

## 10. Verification Checklist

- [ ] Docker image built for `linux/amd64`.
- [ ] Image pushed to Artifact Registry.
- [ ] `OPENAI_API_KEY` secret exists in Secret Manager.
- [ ] Env vars (`LLM_MODE`, `SQLITE_PATH`) configured.
- [ ] Volume mounted at `/data` for persistence.
- [ ] `/health` endpoint returns 200 OK.
- [ ] Frontend loads in browser.
