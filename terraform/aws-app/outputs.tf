data "aws_caller_identity" "current" {}

output "aws_account_id" {
  value       = data.aws_caller_identity.current.account_id
  description = "Connected AWS account ID"
}

output "table_name" {
  value       = module.resources.table_name
  description = "DynamoDB table name (consumed by SAM)"
}

output "files_bucket_name" {
  value       = module.resources.files_bucket_name
  description = "S3 bucket name for user files (consumed by SAM)"
}

output "upload_queue_url" {
  value       = module.resources.upload_queue_url
  description = "SQS upload queue URL"
}

output "upload_queue_arn" {
  value       = module.resources.upload_queue_arn
  description = "SQS upload queue ARN"
}

output "registration_lambda_name" {
  value       = module.resources.registration_lambda_name
  description = "Registration Lambda function name"
}

output "registration_lambda_role_name" {
  value       = module.resources.registration_lambda_role_name
  description = "Registration Lambda IAM role name"
}

output "download_queue_url" {
  value       = module.resources.download_queue_url
  description = "SQS download queue URL"
}

output "download_queue_arn" {
  value       = module.resources.download_queue_arn
  description = "SQS download queue ARN"
}

output "download_counter_lambda_name" {
  value       = module.resources.download_counter_lambda_name
  description = "Download counter Lambda function name"
}

output "download_interface_lambda_name" {
  value       = module.resources.download_interface_lambda_name
  description = "Download interface Lambda function name (invoked by SAM)"
}
