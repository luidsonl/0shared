data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../../../backend/src/health.py"
  output_path = "${path.module}/../../../../../backend/dist/health.zip"
}

resource "aws_lambda_function" "this" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "${var.name_prefix}-health"
  role             = var.lambda_role_arn
  handler          = "health.lambda_handler"
  runtime          = "python3.13"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
}

resource "aws_apigatewayv2_integration" "this" {
  api_id             = var.api_id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.this.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "this" {
  api_id    = var.api_id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.this.id}"
}

resource "aws_lambda_permission" "this" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}
