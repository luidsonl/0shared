output "health_function_name" {
  value = aws_lambda_function.health.function_name
}

output "health_invoke_arn" {
  value = aws_lambda_function.health.invoke_arn
}

output "auth_function_name" {
  value = aws_lambda_function.auth.function_name
}

output "auth_invoke_arn" {
  value = aws_lambda_function.auth.invoke_arn
}

output "auth_function_arn" {
  value = aws_lambda_function.auth.arn
}

output "post_confirmation_function_name" {
  value = aws_lambda_function.post_confirmation.function_name
}

output "post_confirmation_function_arn" {
  value = aws_lambda_function.post_confirmation.arn
}
