RESOURCES := $(shell grep -v '^#' resources.env | grep -v '^$$')
$(foreach v,$(RESOURCES),$(eval $(v)))

export DYNAMODB_TABLE FILES_BUCKET STACK_NAME

.PHONY: deploy start-api test test-aws clean

deploy:
	sam build
	@out=$$(sam deploy 2>&1); \
	  if [ $$? -eq 0 ]; then echo "SAM deploy succeeded."; \
	  elif echo "$$out" | grep -q "No changes to deploy"; then echo "SAM: stack up to date (no changes)."; \
	  else echo "SAM deploy failed:"; echo "$$out"; exit 1; fi

start-api:
	sam local start-api --env-vars env.json --host 0.0.0.0

test:
	npm test

test-aws:
	API_ENDPOINT=$$(aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) \
		--query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
		--output text) npm test

clean:
	scripts/clean.sh
