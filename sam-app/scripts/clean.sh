#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_ENV="$SCRIPT_DIR/../resources.env"

if [ ! -f "$RESOURCES_ENV" ]; then
  echo "ERROR: resources.env not found at $RESOURCES_ENV" >&2
  echo "This file is required. See sam-app/resources.env." >&2
  exit 1
fi

set -a; source "$RESOURCES_ENV"; set +a

TABLE="${TABLE_NAME:-${DYNAMODB_TABLE:?'DYNAMODB_TABLE not set in resources.env'}}"
BUCKET="${BUCKET_NAME:-${FILES_BUCKET:?'FILES_BUCKET not set in resources.env'}}"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --table) TABLE="$2"; shift 2 ;;
    --bucket) BUCKET="$2"; shift 2 ;;
    *)
      echo "Usage: $0 [--dry-run] [--table <name>] [--bucket <name>]"
      exit 1
      ;;
  esac
done

echo "=== DynamoDB: $TABLE ==="
ITEMS=$(aws dynamodb scan --table-name "$TABLE" \
  --attributes-to-get PK SK \
  --output json \
  --query "Items[].[PK.S, SK.S]" 2>/dev/null) || {
  echo "  Table not found. Skipping."
  ITEMS="[]"
}

COUNT=$(echo "$ITEMS" | jq length)
echo "  Items found: $COUNT"

if [ "$COUNT" -gt 0 ] && [ "$DRY_RUN" = false ]; then
  echo "$ITEMS" | jq -c '.[]' | while read -r item; do
    PK=$(echo "$item" | jq -r '.[0]')
    SK=$(echo "$item" | jq -r '.[1]')
    aws dynamodb delete-item \
      --table-name "$TABLE" \
      --key "$(jq -n --arg pk "$PK" --arg sk "$SK" '{PK:{S:$pk}, SK:{S:$sk}}')" \
      --output text > /dev/null 2>&1
  done
  echo "  Cleanup complete."
elif [ "$DRY_RUN" = true ]; then
  echo "  [DRY-RUN] Nothing was deleted."
fi

echo ""
echo "=== S3: $BUCKET ==="
if aws s3 ls "s3://$BUCKET" > /dev/null 2>&1; then
  if [ "$DRY_RUN" = false ]; then
    aws s3 rm "s3://$BUCKET" --recursive --quiet
    echo "  Cleanup complete."
  else
    echo "  [DRY-RUN] Nothing was deleted."
  fi
else
  echo "  Bucket not found. Skipping."
fi

echo ""
echo "=== Done ==="
