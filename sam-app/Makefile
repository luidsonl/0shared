RESOURCES := $(shell grep -v '^#' resources.env | grep -v '^$$')
$(eval $(RESOURCES))

export DYNAMODB_TABLE FILES_BUCKET STACK_NAME

.PHONY: deploy start-api test test-aws clean

deploy:
	sam build && sam deploy

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
