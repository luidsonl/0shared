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

output "download_queue_url" {
  value       = module.download_queue.queue_url
  description = "SQS download queue URL"
}

output "download_queue_arn" {
  value       = module.download_queue.queue_arn
  description = "SQS download queue ARN"
}

output "download_counter_lambda_name" {
  value       = module.download_queue.counter_lambda_name
  description = "Download counter Lambda function name"
}

output "download_interface_lambda_name" {
  value       = module.download_queue.interface_lambda_name
  description = "Download interface Lambda function name (invoked by SAM)"
}
