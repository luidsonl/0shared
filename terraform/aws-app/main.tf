module "resources" {
  source = "./resources"

  namespace    = var.namespace
  project_name = var.project_name
  environment  = var.environment
}
