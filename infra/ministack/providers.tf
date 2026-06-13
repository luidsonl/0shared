provider "aws" {
  region                      = "us-east-1"
  access_key                  = "mock_key"
  secret_key                  = "mock_secret"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    s3           = "http://localhost:4566"
    dynamodb     = "http://localhost:4566"
    lambda       = "http://localhost:4566"
    apigateway   = "http://localhost:4566"
    apigatewayv2 = "http://localhost:4566"
    sts          = "http://localhost:4566"
    iam          = "http://localhost:4566"
    cloudfront   = "http://localhost:4566"
  }

  default_tags {
    tags = {
      "env"     = "dev",
      "project" = "0shared",
      "manager" = "terraform",
      "owner"   = "luidsonl"
    }
  }
}