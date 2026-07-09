# ---------------------------------------------------------------------------
# Modules
# ---------------------------------------------------------------------------
module "database" {
  source     = "./modules/database"
  table_name = "${var.project_name}_${var.environment}"
}

module "files" {
  source      = "./modules/files"
  bucket_name = "${local.full_prefix}-files"
}

module "frontend" {
  source = "./modules/frontend"

  name_prefix = local.name_prefix
  full_prefix = local.full_prefix
}

# ---------------------------------------------------------------------------
# Frontend upload: dist files
# ---------------------------------------------------------------------------
locals {
  mime_types = {
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
    ".svg"  = "image/svg+xml"
    ".json" = "application/json"
    ".txt"  = "text/plain"
  }
}

resource "aws_s3_object" "frontend_files" {
  for_each = fileset("${path.module}/../../../frontend/dist", "**/*")

  bucket = module.frontend.bucket_id
  key    = each.value
  source = "${path.module}/../../../frontend/dist/${each.value}"

  source_hash = filemd5("${path.module}/../../../frontend/dist/${each.value}")

  content_type = lookup(
    local.mime_types,
    regex("\\.[^.]+$", each.value),
    "application/octet-stream"
  )
}
