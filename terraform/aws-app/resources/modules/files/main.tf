resource "aws_s3_bucket" "this" {
  bucket        = var.bucket_name
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_sqs_queue_policy" "s3_upload" {
  queue_url = var.upload_queue_url

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowS3ToSendMessages"
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = var.upload_queue_arn
      Condition = {
        ArnLike = {
          "aws:SourceArn" = aws_s3_bucket.this.arn
        }
      }
    }]
  })
}

resource "aws_s3_bucket_notification" "upload" {
  bucket = aws_s3_bucket.this.id

  queue {
    queue_arn     = var.upload_queue_arn
    events        = ["s3:ObjectCreated:Put", "s3:ObjectCreated:CompleteMultipartUpload"]
    filter_prefix = "uploads/"
  }

  depends_on = [aws_sqs_queue_policy.s3_upload]
}
