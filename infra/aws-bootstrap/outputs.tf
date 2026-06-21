output "state_bucket" {
  value       = aws_s3_bucket.terraform_state.bucket
  description = "S3 bucket name for Terraform state"
}

output "state_bucket_arn" {
  value       = aws_s3_bucket.terraform_state.arn
  description = "S3 bucket ARN for Terraform state"
}

output "lock_table" {
  value       = aws_dynamodb_table.terraform_locks.name
  description = "DynamoDB table name for Terraform state locking"
}

output "lock_table_arn" {
  value       = aws_dynamodb_table.terraform_locks.arn
  description = "DynamoDB table ARN for Terraform state locking"
}
