resource "aws_dynamodb_table" "this" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  lifecycle {
    prevent_destroy = true
  }

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  attribute {
    name = "sub"
    type = "S"
  }
  attribute {
    name = "username_lower"
    type = "S"
  }
  attribute {
    name = "gsiname_pk"
    type = "S"
  }
  attribute {
    name = "gsiname_sk"
    type = "S"
  }
  attribute {
    name = "gsidate_pk"
    type = "S"
  }
  attribute {
    name = "gsidate_sk"
    type = "S"
  }
  attribute {
    name = "gsidown_pk"
    type = "S"
  }
  attribute {
    name = "gsidown_sk"
    type = "S"
  }

  global_secondary_index {
    name               = "SubIndex"
    projection_type    = "INCLUDE"
    non_key_attributes = ["user_id", "username"]
    hash_key           = "sub"
  }

  global_secondary_index {
    name     = "UsernameIndex"
    projection_type = "KEYS_ONLY"
    hash_key = "username_lower"
  }

  global_secondary_index {
    name     = "NameSearch"
    projection_type = "KEYS_ONLY"
    hash_key = "gsiname_pk"
    range_key = "gsiname_sk"
  }

  global_secondary_index {
    name     = "UploadDateIndex"
    projection_type = "KEYS_ONLY"
    hash_key = "gsidate_pk"
    range_key = "gsidate_sk"
  }

  global_secondary_index {
    name     = "DownloadCountIndex"
    projection_type = "KEYS_ONLY"
    hash_key = "gsidown_pk"
    range_key = "gsidown_sk"
  }
}
