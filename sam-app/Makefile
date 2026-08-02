RESOURCES := $(shell grep -v '^#' resources.env | grep -v '^$$')
$(foreach v,$(RESOURCES),$(eval $(v)))

# Prefer the live Terraform output over the resources.env fallback so that
# `make deploy` works with no parameters.
TF_INTERFACE := $(shell cd ../terraform/aws-app && terraform output -raw download_interface_lambda_name 2>/dev/null)
ifneq ($(TF_INTERFACE),)
INTERFACE_LAMBDA_NAME := $(TF_INTERFACE)
endif

export DYNAMODB_TABLE FILES_BUCKET STACK_NAME

REGION ?= us-east-1

.PHONY: build deploy redeploy-api start-api test test-aws clean

build:
	sam build

deploy: build
	@out=$$(sam deploy --parameter-overrides DynamoDBTableName=$(DYNAMODB_TABLE) FilesBucketName=$(FILES_BUCKET) InterfaceLambdaName=$(INTERFACE_LAMBDA_NAME) 2>&1); \
	  if [ $$? -eq 0 ]; then echo "SAM deploy succeeded."; \
	  elif echo "$$out" | grep -q "No changes to deploy"; then echo "SAM: stack up to date (no changes)."; \
	  else echo "SAM deploy failed:"; echo "$$out"; exit 1; fi
	@$(MAKE) redeploy-api

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

start-api:
	sam local start-api --env-vars env.json --host 0.0.0.0

test:
	@if [ -n "$(FILTER)" ]; then npm test -- --grep "$(FILTER)"; else npm test; fi

test-aws:
	API_ENDPOINT=$$(aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) \
		--query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
		--output text) npm test

clean:
	scripts/clean.sh
