locals {
  env_dash    = var.environment != "" ? "-${var.environment}" : ""
  env_under   = var.environment != "" ? "_${var.environment}" : ""
  name_prefix = "${var.project_name}${local.env_dash}"
  full_prefix = "${var.namespace}-${var.project_name}${local.env_dash}"
}
