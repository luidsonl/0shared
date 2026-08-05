# ─────────────────────────────────────────────────────────────────────────────
# 0shared — full-stack deployment orchestrator
#
# Deploy order (each layer feeds the next):
#   1. terraform/aws-bootstrap  → S3 state bucket (one-time)
#   2. terraform/aws-app        → DynamoDB table + S3 files bucket
#   3. sam-app                  → Lambda + API Gateway (exports ApiEndpoint)
#   4. terraform/aws-frontend   → S3 + CloudFront + frontend build/upload
# ─────────────────────────────────────────────────────────────────────────────

TF          ?= terraform
STACK_NAME  ?= app-0shared-backend
REGION      ?= us-east-1

.PHONY: all deploy deploy-full bootstrap infra backend frontend build-frontend frontend-push destroy destroy-backend destroy-frontend

all: deploy

# Regular deployment (skips state bucket — already exists)
deploy: infra backend frontend
	@echo ""
	@echo "=========================================================="
	@echo " Deployment complete."
	@echo " CloudFront: $$(cd terraform/aws-frontend && $(TF) output -raw cloudfront_domain_name)"
	@echo "=========================================================="

# First-time deployment (includes state bucket creation)
deploy-full: bootstrap deploy

# 1. State backend (one-time)
bootstrap:
	cd terraform/aws-bootstrap && $(TF) init -input=false && $(TF) apply -auto-approve

# 2. Stateful infrastructure (DynamoDB + S3 files)
infra:
	cd terraform/aws-app && $(TF) init -input=false && $(TF) apply -auto-approve

# 3. Backend (Lambda + API Gateway)
# INTERFACE_LAMBDA_NAME is auto-derived inside sam-app/Makefile (Terraform output).
# `make deploy` also forces a fresh API Gateway deployment (SAM "empty deployment" race).
backend:
	cd sam-app && $(MAKE) deploy

# 4. Frontend (build → S3 + CloudFront upload/invalidate)
frontend: build-frontend
	cd terraform/aws-frontend && $(TF) init -input=false && $(TF) apply -auto-approve

# Build the React SPA (run before the Terraform upload step)
build-frontend:
	cd frontend && npm install && npm run build

# Force re-upload of the current dist/ + CloudFront invalidation, bypassing the
# terraform null_resource trigger check (escape hatch for stale deploys).
frontend-push:
	@echo "--> Uploading to S3..."
	aws s3 sync frontend/dist/ "s3://$$(cd terraform/aws-frontend && $(TF) output -raw bucket_name)/" --delete
	@echo "--> Invalidating CloudFront..."
	aws cloudfront create-invalidation --distribution-id "$$(cd terraform/aws-frontend && $(TF) output -raw cloudfront_id)" --paths "/*"
	@echo "--> Done!"

# ── Teardown (reverse order) ─────────────────────────────────────────────────
destroy: destroy-frontend destroy-backend
	cd terraform/aws-app && $(TF) destroy -auto-approve
	cd terraform/aws-bootstrap && $(TF) destroy -auto-approve

destroy-backend:
	-sam delete --stack-name $(STACK_NAME) --region $(REGION) --no-prompts

destroy-frontend:
	cd terraform/aws-frontend && $(TF) destroy -auto-approve
