data "aws_caller_identity" "current" {}

output "aws_account_id" {
  value       = data.aws_caller_identity.current.account_id
  description = "Connected AWS account ID"
}

output "cloudfront_domain_name" {
  value       = module.resources.cloudfront_domain_name
  description = "CloudFront distribution domain name"
}

output "cloudfront_id" {
  value       = module.resources.cloudfront_id
  description = "CloudFront distribution ID"
}

output "api_endpoint" {
  value       = module.resources.api_endpoint
  description = "API Gateway endpoint URL"
}

output "cognito_pool_id" {
  value       = module.resources.cognito_pool_id
  description = "Cognito User Pool ID"
}

output "cognito_client_id" {
  value       = module.resources.cognito_client_id
  description = "Cognito User Pool Client ID"
}

output "cognito_domain" {
  value       = module.resources.cognito_domain
  description = "Cognito hosted UI domain"
}
