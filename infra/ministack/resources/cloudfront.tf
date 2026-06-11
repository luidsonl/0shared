resource "aws_cloudfront_distribution" "_0shared_cloudfront" {
  enabled = true

  origin {
    domain_name = aws_s3_bucket._0shared_frontend_bucket.bucket_regional_domain_name
    origin_id   = "S3-OriginLocal"
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-OriginLocal"
    viewer_protocol_policy = "allow-all"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}