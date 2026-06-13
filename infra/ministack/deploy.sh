#!/bin/bash

ENDPOINT_URL="http://localhost:4566"
BUCKET_NAME="luidsonl-0shared-front"
DISTRIBUTION_ID="_0shared_cloudfront"

FRONTEND_DIR="../../frontend"

echo "======================================"
echo "Starting Ministack Deploy"
echo "======================================"

echo "Syncing files from $FRONTEND_DIR to s3://$BUCKET_NAME..."
aws --endpoint-url=$ENDPOINT_URL s3 sync $FRONTEND_DIR s3://$BUCKET_NAME

echo "Deploy completed successfully!"
