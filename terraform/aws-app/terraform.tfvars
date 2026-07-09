# Generates (with defaults below):
#   table  = 0shared
#   files  = luidsonl-0shared-files
#   front  = luidsonl-0shared-front
#   oac    = 0shared-s3-oac
# Keep derived values in sync with sam-app/resources.env
region       = "us-east-1"
namespace    = "luidsonl"
project_name = "0shared"
owner        = "luidsonl"

table_suffix        = ""
files_bucket_suffix = "-files"
front_bucket_suffix = "-front"
oac_name_suffix     = "-s3-oac"
