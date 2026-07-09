module "resources" {
  source = "./resources"

  namespace           = var.namespace
  project_name        = var.project_name
  environment         = var.environment
  table_suffix        = var.table_suffix
  files_bucket_suffix = var.files_bucket_suffix
  front_bucket_suffix = var.front_bucket_suffix
  oac_name_suffix     = var.oac_name_suffix
}
