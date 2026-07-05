data "archive_file" "post_confirmation_lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../../backend/src/auth/post_confirmation.py"
  output_path = "${path.module}/../../../../backend/dist/post_confirmation.zip"
}

resource "aws_lambda_function" "post_confirmation" {
  filename         = data.archive_file.post_confirmation_lambda_zip.output_path
  function_name    = "${var.name_prefix}-post-confirmation"
  role             = var.lambda_role_arn
  handler          = "post_confirmation.lambda_handler"
  runtime          = "python3.13"
  source_code_hash = data.archive_file.post_confirmation_lambda_zip.output_base64sha256
  layers           = [var.common_layer_arn]
}
