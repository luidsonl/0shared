locals {
  frontend_urls = [
    "https://${aws_cloudfront_distribution._0shared_cloudfront.domain_name}",
  ]
}
