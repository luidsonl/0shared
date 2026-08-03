data "aws_region" "current" {}

locals {
  interface_lambda_name = "${var.project_name}-download-interface"
}

# ---------------------------------------------------------------------------
# Archive (shared source)
# ---------------------------------------------------------------------------
data "archive_file" "download_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../../../src"
  output_path = "${path.module}/lambda-download.zip"
}

# ---------------------------------------------------------------------------
# Counter/Interface Lambda (invoked asynchronously by SAM, updates DynamoDB)
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

resource "aws_iam_role_policy" "interface_lambda" {
  name   = "${local.interface_lambda_name}-policy"
  role   = aws_iam_role.interface_lambda.id
  policy = data.aws_iam_policy_document.interface_lambda.json
}

resource "aws_lambda_function" "interface" {
  filename      = data.archive_file.download_lambda.output_path
  function_name = local.interface_lambda_name
  role          = aws_iam_role.interface_lambda.arn
  handler       = "invoke-download-counter.lambdaHandler"
  runtime       = var.lambda_runtime
  timeout       = 10
  memory_size   = 128

  source_code_hash = data.archive_file.download_lambda.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE = var.dynamodb_table_name
    }
  }

  logging_config {
    log_format            = "JSON"
    application_log_level = "INFO"
    system_log_level      = "WARN"
  }
}
