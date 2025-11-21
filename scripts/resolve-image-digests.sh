#!/usr/bin/env bash
set -euo pipefail

# Resolve ECR image digests and generate image-manifest.json
# Usage: ./resolve-image-digests.sh
#
# Reads *_IMAGE_TAG environment variables, resolves digests from ECR,
# and generates image-manifest.json with format:
# {
#   "repo": { "tag": "tagname", "digest": "sha256:..." }
# }

#---------------------------------------
# Constants
#---------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR

PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly PROJECT_ROOT

ENV_FILE="$PROJECT_ROOT/.env"
readonly ENV_FILE

MANIFEST_FILE="$PROJECT_ROOT/image-manifest.json"
readonly MANIFEST_FILE

#---------------------------------------
# Validate environment file
#---------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found" >&2
  exit 1
fi

#---------------------------------------
# Load environment variables
#---------------------------------------
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

#---------------------------------------
# Validate AWS credentials
#---------------------------------------
if ! aws sts get-caller-identity &>/dev/null; then
  echo "Error: AWS credentials not configured" >&2
  exit 1
fi

#---------------------------------------
# Functions
#---------------------------------------

# Check if string is already a digest (sha256:...)
is_digest() {
  [[ "$1" =~ ^sha256:[a-f0-9]{64}$ ]]
}

# Resolve tag to digest from ECR
resolve_digest() {
  local repo tag digest
  repo="$1"
  tag="$2"

  if is_digest "$tag"; then
    echo "$tag"
    return
  fi

  echo "Resolving $repo:$tag..." >&2

  digest=$(aws ecr describe-images \
    --repository-name "$repo" \
    --image-ids imageTag="$tag" \
    --query 'imageDetails[0].imageDigest' \
    --output text 2>/dev/null)

  if [[ -z "$digest" || "$digest" == "None" ]]; then
    echo "Error: Image $repo:$tag not found in ECR" >&2
    exit 1
  fi

  echo "$digest"
}

# Extract repo name from variable name (PREPPER_IMAGE_TAG -> prepper)
var_to_repo() {
  local var_name repo
  var_name="$1"
  repo="${var_name%_IMAGE_TAG}"
  echo "${repo,,}"
}

#---------------------------------------
# Main logic
#---------------------------------------

echo "Resolving image digests..."
declare -a manifest_entries=()
first=true

# Read all *_IMAGE_TAG variables from .env
while IFS='=' read -r var_name value; do
  if [[ ! "$var_name" =~ ^[A-Z]+_IMAGE_TAG$ ]]; then
    continue
  fi

  repo=$(var_to_repo "$var_name")
  digest=$(resolve_digest "$repo" "$value")

  if is_digest "$value"; then
    original_tag="latest"
  else
    original_tag="$value"
  fi

  echo "  $repo: tag=$original_tag, digest=$digest"

  if [[ "$first" == "true" ]]; then
    first=false
  else
    manifest_entries+=(",")
  fi

  manifest_entries+=("$(printf '  \"%s\": {\n    \"tag\": \"%s\",\n    \"digest\": \"%s\"\n  }' "$repo" "$original_tag" "$digest")")
done < <(grep -E '^[A-Z]+_IMAGE_TAG=' "$ENV_FILE")

#---------------------------------------
# Write manifest JSON
#---------------------------------------
{
  echo "{"
  printf '%s\n' "${manifest_entries[@]}"
  echo "}"
} > "$MANIFEST_FILE"

echo "Generated $MANIFEST_FILE"
