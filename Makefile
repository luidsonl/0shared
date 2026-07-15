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

.PHONY: all deploy bootstrap infra backend frontend build-frontend redeploy-api destroy destroy-frontend

all: deploy

# Full ordered deployment
deploy: bootstrap infra backend frontend
	@echo ""
	@echo "=========================================================="
	@echo " Full deployment complete."
	@echo " CloudFront: $$(cd terraform/aws-frontend && $(TF) output -raw cloudfront_domain_name)"
	@echo "=========================================================="

# 1. State backend (one-time)
bootstrap:
	cd terraform/aws-bootstrap && $(TF) init -input=false && $(TF) apply -auto-approve

# 2. Stateful infrastructure (DynamoDB + S3 files)
infra:
	cd terraform/aws-app && $(TF) init -input=false && $(TF) apply -auto-approve

# 3. Backend (Lambda + API Gateway)
backend:
	$(eval INTERFACE_LAMBDA_NAME := $(shell cd terraform/aws-app && $(TF) output -raw download_interface_lambda_name))
	cd sam-app && $(MAKE) deploy INTERFACE_LAMBDA_NAME=$(INTERFACE_LAMBDA_NAME)
	$(MAKE) redeploy-api

# Workaround for the SAM "empty deployment" race: force a fresh deployment
# so the Prod stage actually exposes the routes (avoids "Missing Authentication Token").
redeploy-api:
	@REST_API_ID=$$(aws cloudformation describe-stack-resource \
		--stack-name $(STACK_NAME) \
		--logical-resource-id ServerlessRestApi \
		--query "StackResourceDetail.PhysicalResourceId" \
		--output text --region $(REGION)); \
	echo "Forcing fresh API Gateway deployment for $$REST_API_ID"; \
	aws apigateway create-deployment \
		--rest-api-id $$REST_API_ID \
		--stage-name Prod \
		--region $(REGION) >/dev/null

# 4. Frontend (build → S3 + CloudFront upload/invalidate)
frontend: build-frontend
	cd terraform/aws-frontend && $(TF) init -input=false && $(TF) apply -auto-approve

# Build the React SPA (run before the Terraform upload step)
build-frontend:
	cd frontend && npm install && npm run build

# ── Teardown (reverse order) ─────────────────────────────────────────────────
destroy: destroy-frontend
	-sam delete --stack-name $(STACK_NAME) --region $(REGION) --no-prompt
	cd terraform/aws-app && $(TF) destroy -auto-approve
	cd terraform/aws-bootstrap && $(TF) destroy -auto-approve

destroy-frontend:
	cd terraform/aws-frontend && $(TF) destroy -auto-approve
