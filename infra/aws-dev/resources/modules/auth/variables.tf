variable "name_prefix" {
  type = string
}

variable "full_prefix" {
  type = string
}

variable "lambda_role_arn" {
  type = string
}

variable "common_layer_arn" {
  type = string
}

variable "api_id" {
  type = string
}

variable "api_execution_arn" {
  type = string
}

variable "frontend_urls" {
  type = list(string)
}
