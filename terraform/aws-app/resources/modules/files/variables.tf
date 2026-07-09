variable "bucket_name" {
  type = string
}

variable "cors_allowed_origins" {
  type        = list(string)
  description = "Allowed origins for CORS (e.g. [\"https://example.com\"]). Use [\"*\"] for dev."
  default     = ["*"]
}
