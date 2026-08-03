variable "project_name" {
  type = string
}

variable "dynamodb_table_name" {
  type = string
}

variable "dynamodb_table_arn" {
  type = string
}

variable "lambda_runtime" {
  type    = string
  default = "nodejs22.x"
}
