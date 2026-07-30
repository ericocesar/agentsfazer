#!/usr/bin/env bash
# Build Docker image locally and push to GitHub Container Registry.
# Replicates the logic from publish_github_package.yml for local execution.
set -euo pipefail

# -------------------------
# Config
# -------------------------
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-}"
PROJECT_NAME="${PROJECT_NAME:-}"
PLATFORMS="${PLATFORMS:-linux/amd64}"

# Cloudflare (optional - skip if unset)
R2_BUCKET_NAME="${R2_BUCKET_NAME:-}"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
CDN_WORKER_DISABLED="${CDN_WORKER_DISABLED:-false}"

# Build args (optional)
BUN_PUBLIC_CDN_URL="${BUN_PUBLIC_CDN_URL:-}"
BUN_PUBLIC_EDITION="${BUN_PUBLIC_EDITION:-free}"

# -------------------------
# Helpers
# -------------------------
sanitize_component() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's#^[^a-z0-9]+##; s#[^a-z0-9._-]+#-#g; s#-+#-#g; s#[-._]+$##'
}

detect_project_name() {
  local name=""
  if [[ -n "${PROJECT_NAME}" ]]; then
    name="${PROJECT_NAME}"
  elif [[ -f "package.json" ]]; then
    name="$(sed -nE 's/^[[:space:]]*"name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' package.json | head -n1)"
  fi
  if [[ -z "${name}" ]]; then
    name="$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"
  fi
  name="${name##*/}"
  sanitize_component "${name}"
}

detect_namespace() {
  local namespace=""
  if [[ -n "${IMAGE_NAMESPACE}" ]]; then
    namespace="${IMAGE_NAMESPACE}"
  else
    local remote_url
    remote_url="$(git config --get remote.origin.url 2>/dev/null || true)"
    if [[ -n "${remote_url}" ]]; then
      # Extract owner from git@ or https:// remote
      if echo "${remote_url}" | grep -q 'github.com'; then
        namespace="$(echo "${remote_url}" | sed -E 's#.*github.com[:/]([^/]+)/.*#\1#')"
      fi
    fi
  fi
  if [[ -z "${namespace}" ]]; then
    namespace="$(whoami)"
  fi
  sanitize_component "${namespace}"
}

# -------------------------
# Resolve image identity
# -------------------------
PROJECT_NAME_RESOLVED="$(detect_project_name)"
IMAGE_NAMESPACE_RESOLVED="$(detect_namespace)"
IMAGE_NAME="${REGISTRY}/${IMAGE_NAMESPACE_RESOLVED}/${PROJECT_NAME_RESOLVED}"

# Git info
GIT_SHA_SHORT="$(git rev-parse --short=7 HEAD 2>/dev/null || echo "unknown")"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '[:upper:]' '[:lower:]' | tr '/' '-' || echo "unknown")"
GIT_REF_NAME="${GITHUB_REF_NAME:-${BRANCH}}"

# Detect if current checkout is a tag
IS_TAG=false
TAG_VERSION=""
if git describe --exact-match --tags HEAD >/dev/null 2>&1; then
  IS_TAG=true
  TAG_VERSION="$(git describe --exact-match --tags HEAD)"
fi

TAG_LATEST="latest"
TAG_SHA="sha-${GIT_SHA_SHORT}"
TAG_BRANCH="${BRANCH}"

echo "============================================="
echo "  Build and Push Docker to GHCR"
echo "============================================="
echo "Registry:    ${REGISTRY}"
echo "Image:       ${IMAGE_NAME}"
echo "Project:     ${PROJECT_NAME_RESOLVED}"
echo "Namespace:   ${IMAGE_NAMESPACE_RESOLVED}"
echo "Platforms:   ${PLATFORMS}"
echo "Branch:      ${BRANCH}"
echo "Git SHA:     ${GIT_SHA_SHORT}"
echo "Tags:"
echo "  - ${IMAGE_NAME}:${TAG_LATEST}"
echo "  - ${IMAGE_NAME}:${TAG_SHA}"
echo "  - ${IMAGE_NAME}:${TAG_BRANCH}"
if [[ "${IS_TAG}" == "true" ]]; then
  echo "  - ${IMAGE_NAME}:${TAG_VERSION}"
fi
echo "============================================="

# -------------------------
# 1. Install deps
# -------------------------
echo ""
echo ">>> Installing dependencies..."
bun install --frozen-lockfile

# -------------------------
# 2. Generate Prisma client
# -------------------------
echo ""
echo ">>> Generating Prisma client..."
DATABASE_URL='postgres://localhost:5432/dummy' bun prisma generate

# -------------------------
# 3. Build frontend assets
# -------------------------
echo ""
echo ">>> Building frontend assets..."
NODE_ENV=production \
  BUN_PUBLIC_CDN_URL="${BUN_PUBLIC_CDN_URL}" \
  BUN_PUBLIC_EDITION="${BUN_PUBLIC_EDITION}" \
  bun run build

# -------------------------
# 4. Upload assets to R2 (optional)
# -------------------------
if [[ -n "${R2_BUCKET_NAME}" && -n "${CLOUDFLARE_API_TOKEN}" ]]; then
  echo ""
  echo ">>> Uploading assets to R2 bucket '${R2_BUCKET_NAME}'..."
  cd dist
  find . -type f | while IFS= read -r file; do
    key="${file#./}"
    echo "Uploading ${key}"
    bunx wrangler r2 object put "${R2_BUCKET_NAME}/${key}" --file "${file}" --remote
  done
  cd ..
  echo "    ✓ Assets uploaded to R2"
else
  echo ""
  echo ">>> Skipping R2 upload (R2_BUCKET_NAME or CLOUDFLARE_API_TOKEN not set)"
fi

# -------------------------
# 5. Deploy CDN Worker (optional)
# -------------------------
if [[ -d "workers/cdn" && "${CDN_WORKER_DISABLED}" != "true" && -n "${CLOUDFLARE_API_TOKEN}" ]]; then
  echo ""
  echo ">>> Deploying CDN Worker..."
  cd workers/cdn
  CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN}" \
    CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}" \
    bunx wrangler deploy
  cd ../..
  echo "    ✓ CDN Worker deployed"
else
  echo ""
  echo ">>> Skipping CDN Worker deploy (no workers/cdn or CDN_WORKER_DISABLED=true or CLOUDFLARE_API_TOKEN not set)"
fi

# -------------------------
# 6. Prerequisites: Docker
# -------------------------
echo ""
echo ">>> Checking Docker..."
if ! docker system info > /dev/null 2>&1; then
  echo "❌ Docker daemon not running."
  exit 1
fi

# -------------------------
# 7. Update package.json version (if tag)
# -------------------------
if [[ "${IS_TAG}" == "true" ]]; then
  echo ""
  echo ">>> Updating package.json version to ${TAG_VERSION}..."
  npm version "${TAG_VERSION}" --no-git-tag-version
  echo "    ✓ Version updated"
fi

# -------------------------
# 8. Build and push with Docker Buildx
# -------------------------
echo ""
echo ">>> Setting up Docker Buildx..."
BUILDER_NAME="ghcr-multi"
if ! docker buildx inspect "${BUILDER_NAME}" > /dev/null 2>&1; then
  docker buildx create --name "${BUILDER_NAME}" --use
else
  docker buildx use "${BUILDER_NAME}"
fi
docker buildx inspect --bootstrap > /dev/null
echo "    ✓ Builder ready"

echo ""
echo ">>> Building and pushing Docker image (${PLATFORMS})..."

BUILD_TAGS=(
  -t "${IMAGE_NAME}:${TAG_LATEST}"
  -t "${IMAGE_NAME}:${TAG_SHA}"
  -t "${IMAGE_NAME}:${TAG_BRANCH}"
)
if [[ "${IS_TAG}" == "true" ]]; then
  BUILD_TAGS+=(-t "${IMAGE_NAME}:${TAG_VERSION}")
fi

docker buildx build \
  --platform "${PLATFORMS}" \
  --push \
  -f "./Dockerfile" \
  "${BUILD_TAGS[@]}" \
  --build-arg "BUN_PUBLIC_CDN_URL=${BUN_PUBLIC_CDN_URL}" \
  --build-arg "BUN_PUBLIC_EDITION=${BUN_PUBLIC_EDITION}" \
  --cache-from "type=gha" \
  --cache-to "type=gha,mode=max" \
  .

echo "    ✓ Image built and pushed"

# -------------------------
# 9. Build info
# -------------------------
echo ""
echo ">>> Writing build-info.json..."
BUILD_INFO_FILE="public/build-info.json"
mkdir -p "$(dirname "${BUILD_INFO_FILE}")"
TZ=UTC
DAY="$(TZ=UTC date '+%d')"
MONTH="$(TZ=UTC date '+%m')"
YEAR="$(TZ=UTC date '+%y')"
HOUR="$(TZ=UTC date '+%H')"
MINUTE="$(TZ=UTC date '+%M')"
cat > "${BUILD_INFO_FILE}" << EOF
{
  "IMAGE_TAG": "${TAG_SHA}",
  "BUILD_DATE": "${DAY}/${MONTH}/${YEAR}",
  "BUILD_TIME": "${HOUR}:${MINUTE}",
  "COMMIT": "${GIT_SHA_SHORT}",
  "IMAGE": "${IMAGE_NAME}"
}
EOF
echo "    ✓ build-info.json: ${DAY}/${MONTH}/${YEAR} ${HOUR}:${MINUTE}"

echo ""
echo "============================================="
echo "  Build and Push concluído!"
echo "============================================="
echo ""
echo "Imagem disponível: ${IMAGE_NAME}:${TAG_SHA}"
echo ""
echo "Para puxar: docker pull ${IMAGE_NAME}:${TAG_SHA}"
echo "============================================="
