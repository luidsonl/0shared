module "resources" {
  source = "./resources"

  frontend_urls = var.frontend_urls
  namespace     = var.namespace
  project_name  = var.project_name
}
