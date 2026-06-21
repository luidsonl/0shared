resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api"
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

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.project_name}-cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.frontend.id]
    issuer   = "https://cognito-idp.${data.aws_region.current.region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

module "routes" {
  source = "./routes"

  api_id                = aws_apigatewayv2_api.api.id
  cognito_authorizer_id = aws_apigatewayv2_authorizer.cognito.id
  health_lambda_arn     = module.lambdas.health_invoke_arn
  health_lambda_name    = module.lambdas.health_function_name
  auth_lambda_arn       = module.lambdas.auth_invoke_arn
  auth_lambda_name      = module.lambdas.auth_function_name
  api_execution_arn     = aws_apigatewayv2_api.api.execution_arn
}
