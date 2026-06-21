variable "region" {
  type    = string
  default = "us-east-1"
}

variable "namespace" {
  type        = string
  description = "Unique namespace prefix for globally unique resource names (e.g. S3 buckets, Cognito domains)"
}

variable "project_name" {
  type        = string
  description = "Base name used for most resource names"
}

variable "environment" {
  type        = string
  description = "Environment tag value"
  default     = "dev"
}

variable "owner" {
  type        = string
  description = "Owner tag value"
  default     = null
}

variable "frontend_urls" {
  type        = list(string)
  description = "Public frontend URLs for Cognito callbacks. Defaults to S3 website endpoint."
  default     = null
}
