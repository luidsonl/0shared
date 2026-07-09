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

output "table_name" {
  value       = module.resources.table_name
  description = "DynamoDB table name (consumed by SAM)"
}

output "files_bucket_name" {
  value       = module.resources.files_bucket_name
  description = "S3 bucket name for user files (consumed by SAM)"
}
