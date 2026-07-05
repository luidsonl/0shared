data "archive_file" "auth_lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../../backend/src/auth/handler.py"
  output_path = "${path.module}/../../../../backend/dist/auth.zip"
}

resource "aws_lambda_function" "auth" {
  filename         = data.archive_file.auth_lambda_zip.output_path
  function_name    = "${var.name_prefix}-auth"
  role             = var.lambda_role_arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.13"
  source_code_hash = data.archive_file.auth_lambda_zip.output_base64sha256
  layers           = [var.common_layer_arn]
}
