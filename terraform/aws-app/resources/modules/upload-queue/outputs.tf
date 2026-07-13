output "queue_url" {
  value = aws_sqs_queue.this.id
}

output "queue_arn" {
  value = aws_sqs_queue.this.arn
}

output "dlq_url" {
  value = aws_sqs_queue.dlq.id
}

output "dlq_arn" {
  value = aws_sqs_queue.dlq.arn
}

output "lambda_function_name" {
  value = aws_lambda_function.registration.function_name
}

output "lambda_function_arn" {
  value = aws_lambda_function.registration.arn
}

output "lambda_role_name" {
  value = aws_iam_role.registration_lambda.name
}
