resource "aws_apigatewayv2_integration" "auth_integration" {
  api_id             = var.api_id
  integration_type   = "AWS_PROXY"
  integration_uri    = var.auth_lambda_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "auth_signup" {
  api_id        = var.api_id
  route_key     = "POST /auth/signup"
  target        = "integrations/${aws_apigatewayv2_integration.auth_integration.id}"
  authorizer_id = var.cognito_authorizer_id
}

resource "aws_apigatewayv2_route" "auth_get_me" {
  api_id        = var.api_id
  route_key     = "GET /auth/me"
  target        = "integrations/${aws_apigatewayv2_integration.auth_integration.id}"
  authorizer_id = var.cognito_authorizer_id
}

resource "aws_apigatewayv2_route" "auth_update_me" {
  api_id        = var.api_id
  route_key     = "PUT /auth/me"
  target        = "integrations/${aws_apigatewayv2_integration.auth_integration.id}"
  authorizer_id = var.cognito_authorizer_id
}

resource "aws_apigatewayv2_route" "auth_change_username" {
  api_id        = var.api_id
  route_key     = "PUT /auth/me/username"
  target        = "integrations/${aws_apigatewayv2_integration.auth_integration.id}"
  authorizer_id = var.cognito_authorizer_id
}

resource "aws_lambda_permission" "api_gw_auth" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.auth_lambda_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}
