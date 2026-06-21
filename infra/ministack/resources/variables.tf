variable "frontend_urls" {
  type        = list(string)
  description = "Public frontend URLs for Cognito callbacks. Defaults to S3 website endpoint."
  default     = null
}

variable "namespace" {
  type = string
}

variable "project_name" {
  type = string
}
