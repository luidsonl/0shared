#!/usr/bin/env bash
set -euo pipefail

TABLE="${TABLE_NAME:-0shared_dev}"
BUCKET="${BUCKET_NAME:-luidsonl-0shared-dev-files}"
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
  echo "  Tabela nao encontrada. Pulando."
  ITEMS="[]"
}

COUNT=$(echo "$ITEMS" | jq length)
echo "  Itens encontrados: $COUNT"

if [ "$COUNT" -gt 0 ] && [ "$DRY_RUN" = false ]; then
  echo "$ITEMS" | jq -c '.[]' | while read -r item; do
    PK=$(echo "$item" | jq -r '.[0]')
    SK=$(echo "$item" | jq -r '.[1]')
    aws dynamodb delete-item \
      --table-name "$TABLE" \
      --key "$(jq -n --arg pk "$PK" --arg sk "$SK" '{PK:{S:$pk}, SK:{S:$sk}}')" \
      --output text > /dev/null 2>&1
  done
  echo "  Limpeza concluida."
elif [ "$DRY_RUN" = true ]; then
  echo "  [DRY-RUN] Nada foi deletado."
fi

echo ""
echo "=== S3: $BUCKET ==="
if aws s3 ls "s3://$BUCKET" > /dev/null 2>&1; then
  if [ "$DRY_RUN" = false ]; then
    aws s3 rm "s3://$BUCKET" --recursive --quiet
    echo "  Limpeza concluida."
  else
    echo "  [DRY-RUN] Nada foi deletado."
  fi
else
  echo "  Bucket nao encontrado. Pulando."
fi

echo ""
echo "=== Pronto ==="
