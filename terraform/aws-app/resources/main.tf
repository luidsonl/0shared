# ---------------------------------------------------------------------------
# Modules
# ---------------------------------------------------------------------------
module "database" {
  source     = "./modules/database"
  table_name = "${var.project_name}${local.env_under}${var.table_suffix}"
}

  module "files" {
    source      = "./modules/files"
    bucket_name = "${local.full_prefix}${var.files_bucket_suffix}"
  }
