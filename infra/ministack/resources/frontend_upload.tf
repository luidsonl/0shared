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
# Generates env.js with the actual API Gateway URL
resource "aws_s3_object" "env_config" {
  bucket      = aws_s3_bucket._0shared_frontend_bucket.id
  key         = "env.js"
  content     = templatefile("${path.module}/../templates/env.tpl.js", {
    api_endpoint      = aws_apigatewayv2_api.api.api_endpoint
    cognito_pool_id   = aws_cognito_user_pool.main.id
    cognito_client_id = aws_cognito_user_pool_client.frontend.id
    cognito_domain    = aws_cognito_user_pool_domain.main.domain
  })
  content_type = "application/javascript"
}

# Uploads all frontend build files to S3
resource "aws_s3_object" "frontend_files" {
  for_each = fileset("${path.module}/../../../frontend/dist", "**/*")

  bucket      = aws_s3_bucket._0shared_frontend_bucket.id
  key         = each.value
  source      = "${path.module}/../../../frontend/dist/${each.value}"
  
  source_hash = filemd5("${path.module}/../../../frontend/dist/${each.value}")

  content_type = lookup(
    local.mime_types,
    regex("\\.[^.]+$", each.value),
    "application/octet-stream"
  )
}
