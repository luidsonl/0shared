# ---------------------------------------------------------------------------
# API Gateway
# ---------------------------------------------------------------------------
resource "aws_apigatewayv2_api" "api" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

data "aws_region" "current" {}

# ---------------------------------------------------------------------------
# IAM: Lambda execution role + DynamoDB policy + common layer
# ---------------------------------------------------------------------------
data "archive_file" "common_layer_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../../backend/src/layer/python"
  output_path = "${path.module}/../../../backend/dist/common_layer.zip"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda_exec_role" {
  name               = "${var.project_name}_${var.environment}_lambda_exec_role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "dynamodb_access" {
  name        = "${var.project_name}_${var.environment}_dynamodb_access"
  description = "Allow Lambda to access DynamoDB table"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:TransactWriteItems",
        ]
        Resource = module.database.table_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

resource "aws_lambda_layer_version" "common" {
  filename            = data.archive_file.common_layer_zip.output_path
  layer_name          = "${local.name_prefix}-common"
  source_code_hash    = data.archive_file.common_layer_zip.output_base64sha256
  compatible_runtimes = ["python3.13"]
}

# ---------------------------------------------------------------------------
# Modules
# ---------------------------------------------------------------------------
module "database" {
  source     = "./modules/database"
  table_name = "${var.project_name}_${var.environment}"
}

module "files" {
  source      = "./modules/files"
  bucket_name = "${local.full_prefix}-files"
}

module "frontend" {
  source = "./modules/frontend"

  name_prefix = local.name_prefix
  full_prefix = local.full_prefix
}

module "health" {
  source = "./modules/health"

  name_prefix       = local.name_prefix
  lambda_role_arn   = aws_iam_role.lambda_exec_role.arn
  common_layer_arn  = aws_lambda_layer_version.common.arn
  api_id            = aws_apigatewayv2_api.api.id
  api_execution_arn = aws_apigatewayv2_api.api.execution_arn
}

module "auth" {
  source = "./modules/auth"

  name_prefix       = local.name_prefix
  full_prefix       = local.full_prefix
  lambda_role_arn   = aws_iam_role.lambda_exec_role.arn
  common_layer_arn  = aws_lambda_layer_version.common.arn
  api_id            = aws_apigatewayv2_api.api.id
  api_execution_arn = aws_apigatewayv2_api.api.execution_arn
  frontend_urls     = local.frontend_urls
}

# ---------------------------------------------------------------------------
# Frontend upload: env.js config
# ---------------------------------------------------------------------------
resource "aws_s3_object" "env_config" {
  bucket = module.frontend.bucket_id
  key    = "env.js"
  content = templatefile("${path.module}/../templates/env.tpl.js", {
    api_endpoint      = aws_apigatewayv2_api.api.api_endpoint
    cognito_pool_id   = module.auth.pool_id
    cognito_client_id = module.auth.client_id
    cognito_domain    = module.auth.domain
  })
  content_type = "application/javascript"
}

# ---------------------------------------------------------------------------
# Frontend upload: dist files
# ---------------------------------------------------------------------------
locals {
  mime_types = {
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
    ".svg"  = "image/svg+xml"
    ".json" = "application/json"
    ".txt"  = "text/plain"
  }
}

resource "aws_s3_object" "frontend_files" {
  for_each = fileset("${path.module}/../../../frontend/dist", "**/*")

  bucket = module.frontend.bucket_id
  key    = each.value
  source = "${path.module}/../../../frontend/dist/${each.value}"

  source_hash = filemd5("${path.module}/../../../frontend/dist/${each.value}")

  content_type = lookup(
    local.mime_types,
    regex("\\.[^.]+$", each.value),
    "application/octet-stream"
  )
}
