locals {
  frontend_urls = var.frontend_urls != null ? var.frontend_urls : [
    "http://${aws_cloudfront_distribution._0shared_cloudfront.domain_name}",
  ]
}
