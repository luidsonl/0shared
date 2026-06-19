data "archive_file" "auth_lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../../backend/src/auth/handler.py"
  output_path = "${path.module}/../../../../backend/dist/auth.zip"
}

resource "aws_lambda_function" "auth" {
  filename         = data.archive_file.auth_lambda_zip.output_path
  function_name    = "0shared-auth"
  role             = var.lambda_role_arn
  handler          = "handler.lambda_handler"
  runtime          = "python3.10"
  source_code_hash = data.archive_file.auth_lambda_zip.output_base64sha256
  layers           = [var.common_layer_arn]
}
