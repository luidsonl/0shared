locals {
  frontend_urls = var.frontend_urls != null ? var.frontend_urls : [
    "http://${aws_s3_bucket_website_configuration.frontend.website_endpoint}",
    "http://${aws_cloudfront_distribution._0shared_cloudfront.domain_name}",
  ]
}
