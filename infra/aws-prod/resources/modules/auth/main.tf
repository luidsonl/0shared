data "archive_file" "auth_lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../../../backend/src/auth/handler.py"
  output_path = "${path.module}/../../../../../backend/dist/auth.zip"
}

data "archive_file" "post_confirmation_lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../../../../../backend/src/auth/post_confirmation.py"
  output_path = "${path.module}/../../../../../backend/dist/post_confirmation.zip"
}

data "aws_region" "current" {}

resource "aws_cognito_user_pool" "this" {
  name = "${var.name_prefix}-user-pool"

  lambda_config {
    post_confirmation = aws_lambda_function.post_confirmation.arn
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  tags = {
    Name = "${var.name_prefix}-user-pool"
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name         = "${var.name_prefix}-frontend-client"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = var.frontend_urls
  logout_urls                          = var.frontend_urls
  supported_identity_providers         = ["COGNITO"]
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = "${var.full_prefix}-auth"
  user_pool_id = aws_cognito_user_pool.this.id
}

resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoToInvokePostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post_confirmation.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.this.arn
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

resource "aws_lambda_function" "post_confirmation" {
  filename         = data.archive_file.post_confirmation_lambda_zip.output_path
  function_name    = "${var.name_prefix}-post-confirmation"
  role             = var.lambda_role_arn
  handler          = "post_confirmation.lambda_handler"
  runtime          = "python3.13"
  source_code_hash = data.archive_file.post_confirmation_lambda_zip.output_base64sha256
  layers           = [var.common_layer_arn]
}

resource "aws_apigatewayv2_authorizer" "this" {
  api_id           = var.api_id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.name_prefix}-cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.this.id]
    issuer   = "https://cognito-idp.${data.aws_region.current.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
  }
}

resource "aws_apigatewayv2_integration" "auth" {
  api_id             = var.api_id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.auth.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "auth_signup" {
  api_id        = var.api_id
  route_key     = "POST /auth/signup"
  target        = "integrations/${aws_apigatewayv2_integration.auth.id}"
  authorizer_id = aws_apigatewayv2_authorizer.this.id
}

resource "aws_apigatewayv2_route" "auth_get_me" {
  api_id        = var.api_id
  route_key     = "GET /auth/me"
  target        = "integrations/${aws_apigatewayv2_integration.auth.id}"
  authorizer_id = aws_apigatewayv2_authorizer.this.id
}

resource "aws_apigatewayv2_route" "auth_update_me" {
  api_id        = var.api_id
  route_key     = "PUT /auth/me"
  target        = "integrations/${aws_apigatewayv2_integration.auth.id}"
  authorizer_id = aws_apigatewayv2_authorizer.this.id
}

resource "aws_apigatewayv2_route" "auth_change_username" {
  api_id        = var.api_id
  route_key     = "PUT /auth/me/username"
  target        = "integrations/${aws_apigatewayv2_integration.auth.id}"
  authorizer_id = aws_apigatewayv2_authorizer.this.id
}

resource "aws_lambda_permission" "api_gw_auth" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_execution_arn}/*/*"
}
