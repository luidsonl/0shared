variable "bucket_name" {
  type = string
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "Allowed origins for CORS (e.g. [\"https://example.com\"]). Use [\"*\"] for dev."
  default     = ["*"]
}

variable "upload_queue_arn" {
  type        = string
  description = "ARN of the SQS queue for upload events."
}

variable "upload_queue_url" {
  type        = string
  description = "URL of the SQS queue for upload events."
}
