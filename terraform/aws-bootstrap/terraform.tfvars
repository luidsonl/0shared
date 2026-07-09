# Must match the bucket name used in terraform/aws-app/backend.hcl
# Globally unique (buckets are global namespace)
region            = "us-east-1"
state_bucket_name = "luidsonl-0shared-terraform-state"
project_name      = "0shared"
owner             = "luidsonl"
environment       = ""
