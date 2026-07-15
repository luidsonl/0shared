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

output "interface_lambda_name" {
  value = aws_lambda_function.interface.function_name
}

output "interface_lambda_arn" {
  value = aws_lambda_function.interface.arn
}

output "counter_lambda_name" {
  value = aws_lambda_function.counter.function_name
}

output "counter_lambda_arn" {
  value = aws_lambda_function.counter.arn
}

output "lambda_role_name" {
  value = aws_iam_role.counter_lambda.name
}
