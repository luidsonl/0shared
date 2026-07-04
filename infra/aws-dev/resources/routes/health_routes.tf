resource "aws_apigatewayv2_integration" "health_integration" {
  api_id             = var.api_id
  integration_type   = "AWS_PROXY"
  integration_uri    = var.health_lambda_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "health_route" {
  api_id    = var.api_id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.health_integration.id}"
}

resource "aws_lambda_permission" "api_gw_health" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.health_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}
