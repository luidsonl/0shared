output "table_name" {
  value       = module.database.table_name
  description = "DynamoDB table name (consumed by SAM)"
}

output "files_bucket_name" {
  value       = module.files.bucket_id
  description = "S3 bucket name for user files (consumed by SAM)"
}
