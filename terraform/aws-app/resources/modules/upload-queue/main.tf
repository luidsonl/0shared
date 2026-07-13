data "aws_region" "current" {}

locals {
  lambda_name = "${var.project_name}-registration"
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
# Registration Lambda (SQS-triggered, not API-triggered)
# ---------------------------------------------------------------------------
data "archive_file" "registration_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../../../src"
  output_path = "${path.module}/lambda-registration.zip"
}

resource "aws_iam_role" "registration_lambda" {
  name = "${local.lambda_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
      Effect    = "Allow"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "registration_lambda_basic" {
  role       = aws_iam_role.registration_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "registration_lambda" {
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

  # DynamoDB permissions
  statement {
    sid    = "DynamoDBAccess"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
    ]
    resources = [
      var.dynamodb_table_arn,
      "${var.dynamodb_table_arn}/index/*",
    ]
  }

  # S3 permissions (HeadObject + GetObject)
  statement {
    sid    = "S3Read"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:HeadObject",
    ]
    resources = ["${var.files_bucket_arn}/*"]
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

resource "aws_iam_role_policy" "registration_lambda" {
  name   = "${local.lambda_name}-policy"
  role   = aws_iam_role.registration_lambda.id
  policy = data.aws_iam_policy_document.registration_lambda.json
}

resource "aws_lambda_function" "registration" {
  filename      = data.archive_file.registration_lambda.output_path
  function_name = local.lambda_name
  role          = aws_iam_role.registration_lambda.arn
  handler       = "register-upload.lambdaHandler"
  runtime       = "nodejs22.x"
  timeout       = 60
  memory_size   = 128

  source_code_hash = data.archive_file.registration_lambda.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = var.dynamodb_table_name
      FILES_BUCKET   = var.files_bucket_name
    }
  }

  logging_config {
    log_format = "JSON"
    application_log_level = "INFO"
    system_log_level      = "WARN"
  }
}

# ---------------------------------------------------------------------------
# Event Source Mapping (SQS → Lambda)
# ---------------------------------------------------------------------------
resource "aws_lambda_event_source_mapping" "this" {
  event_source_arn = aws_sqs_queue.this.arn
  function_name    = aws_lambda_function.registration.arn
  batch_size       = 10
  enabled          = true

  function_response_types = ["ReportBatchItemFailures"]
}
