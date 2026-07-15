data "aws_region" "current" {}

locals {
  interface_lambda_name = "${var.project_name}-download-interface"
  counter_lambda_name  = "${var.project_name}-download-counter"
}

# ---------------------------------------------------------------------------
# SQS Queues
# ---------------------------------------------------------------------------
resource "aws_sqs_queue" "dlq" {
  name                      = "${var.queue_name}-dlq"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "this" {
  name                       = var.queue_name
  visibility_timeout_seconds = 240 # 4 min (Lambda timeout * 6)
  message_retention_seconds  = 1209600 # 14 days

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}

# ---------------------------------------------------------------------------
# Archive (shared source for both Lambdas)
# ---------------------------------------------------------------------------
data "archive_file" "download_lambdas" {
  type        = "zip"
  source_dir  = "${path.module}/../../../src"
  output_path = "${path.module}/lambda-download.zip"
}

# ---------------------------------------------------------------------------
# Interface Lambda (invoked by SAM, sends SQS message)
# ---------------------------------------------------------------------------
resource "aws_iam_role" "interface_lambda" {
  name = "${local.interface_lambda_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
      Effect    = "Allow"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "interface_lambda_basic" {
  role       = aws_iam_role.interface_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "interface_lambda" {
  # SQS send permissions
  statement {
    sid    = "SQSSend"
    effect = "Allow"
    actions = [
      "sqs:SendMessage",
    ]
    resources = [aws_sqs_queue.this.arn]
  }

  # CloudWatch Logs
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:*:*"]
  }
}

resource "aws_iam_role_policy" "interface_lambda" {
  name   = "${local.interface_lambda_name}-policy"
  role   = aws_iam_role.interface_lambda.id
  policy = data.aws_iam_policy_document.interface_lambda.json
}

resource "aws_lambda_function" "interface" {
  filename      = data.archive_file.download_lambdas.output_path
  function_name = local.interface_lambda_name
  role          = aws_iam_role.interface_lambda.arn
  handler       = "invoke-download-counter.lambdaHandler"
  runtime       = "nodejs22.x"
  timeout       = 10
  memory_size   = 128

  source_code_hash = data.archive_file.download_lambdas.output_base64sha256

  environment {
    variables = {
      DOWNLOAD_QUEUE_URL = aws_sqs_queue.this.id
    }
  }

  logging_config {
    log_format          = "JSON"
    application_log_level = "INFO"
    system_log_level      = "WARN"
  }
}

# ---------------------------------------------------------------------------
# Counter Lambda (SQS-triggered, updates DynamoDB)
# ---------------------------------------------------------------------------
resource "aws_iam_role" "counter_lambda" {
  name = "${local.counter_lambda_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
      Effect    = "Allow"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "counter_lambda_basic" {
  role       = aws_iam_role.counter_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "counter_lambda" {
  # SQS permissions
  statement {
    sid    = "SQSReceive"
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.this.arn]
  }

  # DynamoDB permissions (GetItem + UpdateItem)
  statement {
    sid    = "DynamoDBAccess"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
    ]
    resources = [
      var.dynamodb_table_arn,
      "${var.dynamodb_table_arn}/index/*",
    ]
  }

  # CloudWatch Logs
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${data.aws_region.current.name}:*:*"]
  }
}

resource "aws_iam_role_policy" "counter_lambda" {
  name   = "${local.counter_lambda_name}-policy"
  role   = aws_iam_role.counter_lambda.id
  policy = data.aws_iam_policy_document.counter_lambda.json
}

resource "aws_lambda_function" "counter" {
  filename      = data.archive_file.download_lambdas.output_path
  function_name = local.counter_lambda_name
  role          = aws_iam_role.counter_lambda.arn
  handler       = "register-download.lambdaHandler"
  runtime       = "nodejs22.x"
  timeout       = 60
  memory_size   = 128

  source_code_hash = data.archive_file.download_lambdas.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = var.dynamodb_table_name
    }
  }

  logging_config {
    log_format          = "JSON"
    application_log_level = "INFO"
    system_log_level      = "WARN"
  }
}

# ---------------------------------------------------------------------------
# Event Source Mapping (SQS → Counter Lambda)
# ---------------------------------------------------------------------------
resource "aws_lambda_event_source_mapping" "this" {
  event_source_arn = aws_sqs_queue.this.arn
  function_name    = aws_lambda_function.counter.arn
  batch_size       = 10
  enabled          = true

  function_response_types = ["ReportBatchItemFailures"]
}
