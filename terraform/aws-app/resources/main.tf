# ---------------------------------------------------------------------------
# Modules
# ---------------------------------------------------------------------------
module "database" {
  source     = "./modules/database"
  table_name = "${var.project_name}${local.env_under}${var.table_suffix}"
}

module "files" {
  source            = "./modules/files"
  bucket_name       = "${local.full_prefix}${var.files_bucket_suffix}"
  upload_queue_arn  = module.upload_queue.queue_arn
  upload_queue_url  = module.upload_queue.queue_url
}

module "upload_queue" {
  source              = "./modules/upload-queue"
  queue_name          = "${var.project_name}${local.env_under}${var.queue_suffix}"
  project_name        = var.project_name
  dynamodb_table_name = module.database.table_name
  dynamodb_table_arn  = module.database.table_arn
  files_bucket_name   = "${local.full_prefix}${var.files_bucket_suffix}"
  files_bucket_arn    = "arn:aws:s3:::${local.full_prefix}${var.files_bucket_suffix}"
}
