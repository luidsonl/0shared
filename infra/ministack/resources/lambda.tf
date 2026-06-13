# Native Terraform packaging for the Health Lambda
data "archive_file" "health_lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../backend/src/health.py"
  output_path = "${path.module}/../../../backend/dist/health.zip"
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

resource "aws_lambda_function" "health" {
  filename         = data.archive_file.health_lambda_zip.output_path
  function_name    = "0shared-health"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "health.lambda_handler"
  runtime          = "python3.10"
  source_code_hash = data.archive_file.health_lambda_zip.output_base64sha256
}
