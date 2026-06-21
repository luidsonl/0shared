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
  name               = "0shared_lambda_exec_role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "dynamodb_access" {
  name        = "0shared_dynamodb_access"
  description = "Allow Lambda to access 0shared_data DynamoDB table"

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
        Resource = aws_dynamodb_table._0shared_data.arn
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
  layer_name          = "0shared-common"
  source_code_hash    = data.archive_file.common_layer_zip.output_base64sha256
  compatible_runtimes = ["python3.10"]
}

module "lambdas" {
  source = "./lambdas"

  lambda_role_arn  = aws_iam_role.lambda_exec_role.arn
  common_layer_arn = aws_lambda_layer_version.common.arn
}
