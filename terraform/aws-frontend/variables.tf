variable "region" {
  type    = string
  default = "us-east-1"
}

variable "namespace" {
  type        = string
  description = "Unique namespace prefix for globally unique resource names (e.g. S3 buckets)"
}

variable "project_name" {
  type        = string
  description = "Base name used for most resource names"
}

variable "environment" {
  type        = string
  description = "Environment name (e.g. staging, prod). Leave empty for default."
  default     = ""
}

variable "front_bucket_suffix" {
  type        = string
  description = "Suffix appended to the frontend S3 bucket name (e.g. '-www')"
  default     = "-front"
}

variable "oac_name_suffix" {
  type        = string
  description = "Suffix appended to the CloudFront OAC name (e.g. '-oac')"
  default     = "-s3-oac"
}
