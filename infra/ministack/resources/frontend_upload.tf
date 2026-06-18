locals {
  # Mapping of extensions to Content-Types
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

# Uploads all frontend files to S3
resource "aws_s3_object" "frontend_files" {
  # fileset scans the entire folder and returns a list of relative paths
  for_each = fileset("${path.module}/../../../frontend/dist", "**/*")

  bucket      = aws_s3_bucket._0shared_frontend_bucket.id
  key         = each.value
  source      = "${path.module}/../../../frontend/${each.value}"
  
  # Automatically updates the file in S3 if the local content changes
  source_hash = filemd5("${path.module}/../../../frontend/${each.value}")

  # Adds the correct content-type based on the extension
  content_type = lookup(
    local.mime_types,
    regex("\\.[^.]+$", each.value),
    "application/octet-stream"
  )
}
