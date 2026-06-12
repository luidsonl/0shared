data "aws_caller_identity" "current" {}

output "aws_account_id" {
  value       = data.aws_caller_identity.current.account_id
  description = "Connected AWS account ID"
}

output "cloudfront_domain_name" {
  value       = module.resources.cloudfront_domain_name
  description = "Local CloudFront URL for testing"
}

output "cloudfront_id" {
  value       = module.resources.cloudfront_id
  description = "Local CloudFront distribution ID"
}