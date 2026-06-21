resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  lambda_config {
    post_confirmation = module.lambdas.post_confirmation_function_arn
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
    Name = "${var.project_name}-user-pool"
  }
}

resource "aws_cognito_user_pool_client" "frontend" {
  name         = "${var.project_name}-frontend-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = local.frontend_urls
  logout_urls                          = local.frontend_urls
  supported_identity_providers         = ["COGNITO"]
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.namespace}-${var.project_name}-auth"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_lambda_permission" "cognito_post_confirmation" {
  statement_id  = "AllowCognitoToInvokePostConfirmation"
  action        = "lambda:InvokeFunction"
  function_name = module.lambdas.post_confirmation_function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}
