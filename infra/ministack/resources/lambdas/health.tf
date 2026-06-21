data "archive_file" "health_lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../../backend/src/health.py"
  output_path = "${path.module}/../../../../backend/dist/health.zip"
}

resource "aws_lambda_function" "health" {
  filename         = data.archive_file.health_lambda_zip.output_path
  function_name    = "${var.project_name}-health"
  role             = var.lambda_role_arn
  handler          = "health.lambda_handler"
  runtime          = "python3.10"
  source_code_hash = data.archive_file.health_lambda_zip.output_base64sha256
}
