resource "aws_dynamodb_table" "_0shared_data" {
  name         = "${var.project_name}_data"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

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

    key_schema {
      attribute_name = "sub"
      key_type       = "HASH"
    }
  }

  global_secondary_index {
    name            = "UsernameIndex"
    projection_type = "KEYS_ONLY"

    key_schema {
      attribute_name = "username_lower"
      key_type       = "HASH"
    }
  }

  global_secondary_index {
    name            = "NameSearch"
    projection_type = "KEYS_ONLY"

    key_schema {
      attribute_name = "gsiname_pk"
      key_type       = "HASH"
    }
    key_schema {
      attribute_name = "gsiname_sk"
      key_type       = "RANGE"
    }
  }

  global_secondary_index {
    name            = "UploadDateIndex"
    projection_type = "KEYS_ONLY"

    key_schema {
      attribute_name = "gsidate_pk"
      key_type       = "HASH"
    }
    key_schema {
      attribute_name = "gsidate_sk"
      key_type       = "RANGE"
    }
  }

  global_secondary_index {
    name            = "DownloadCountIndex"
    projection_type = "KEYS_ONLY"

    key_schema {
      attribute_name = "gsidown_pk"
      key_type       = "HASH"
    }
    key_schema {
      attribute_name = "gsidown_sk"
      key_type       = "RANGE"
    }
  }
}
