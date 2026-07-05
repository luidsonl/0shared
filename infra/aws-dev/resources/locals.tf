locals {
  name_prefix = "${var.project_name}-${var.environment}"
  full_prefix = "${var.namespace}-${var.project_name}-${var.environment}"

  frontend_urls = [
    "https://${module.frontend.cloudfront_domain_name}",
  ]
}
