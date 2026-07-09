# Generates (with defaults below):
#   table  = 0shared
#   files  = luidsonl-0shared-files
# Frontend (S3 + CloudFront + OAC) now lives in terraform/aws-frontend
# Keep derived values in sync with sam-app/resources.env
region       = "us-east-1"
namespace    = "luidsonl"
project_name = "0shared"
owner        = "luidsonl"

table_suffix        = ""
files_bucket_suffix = "-files"
