#!/bin/bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ltcc-492815}"
REGION="${REGION:-us-central1}"
REPOSITORY="${REPOSITORY:-myrepo}"
SERVICE_NAME="${SERVICE_NAME:-myapp}"
IMAGE_NAME="${IMAGE_NAME:-myapp}"
FRONTEND_URL="${FRONTEND_URL:-https://mikidalhub.github.io/llm-startup}"

IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$IMAGE_NAME:latest"

echo "Using project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

echo "Enabling required Google Cloud APIs..."
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

echo "Ensuring Artifact Registry repository exists..."
if ! gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Docker repository for Cloud Run deployments"
fi

echo "Configuring Docker authentication for Artifact Registry..."
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

echo "Building image: $IMAGE_URI"
docker build -t "$IMAGE_URI" .

echo "Pushing image: $IMAGE_URI"
docker push "$IMAGE_URI"

echo "Deploying to Cloud Run service: $SERVICE_NAME"
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_URI" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "CORS_ALLOWED_ORIGIN=$FRONTEND_URL" \
  --memory 512Mi \
  --port 8080 \
  --min-instances 0 \
  --max-instances 3

echo "Deployment complete."
