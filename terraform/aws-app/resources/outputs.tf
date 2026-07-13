output "table_name" {
  value       = module.database.table_name
  description = "DynamoDB table name (consumed by SAM)"
}

output "files_bucket_name" {
  value       = module.files.bucket_id
  description = "S3 bucket name for user files (consumed by SAM)"
}

output "upload_queue_url" {
  value       = module.upload_queue.queue_url
  description = "SQS upload queue URL"
}

output "upload_queue_arn" {
  value       = module.upload_queue.queue_arn
  description = "SQS upload queue ARN"
}

output "registration_lambda_name" {
  value       = module.upload_queue.lambda_function_name
  description = "Registration Lambda function name"
}

output "registration_lambda_role_name" {
  value       = module.upload_queue.lambda_role_name
  description = "Registration Lambda IAM role name"
}
