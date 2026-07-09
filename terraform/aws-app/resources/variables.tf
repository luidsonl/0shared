variable "namespace" {
  type = string
}

variable "project_name" {
  type = string
}

variable "environment" {
  type    = string
  default = ""
}

variable "table_suffix" {
  type    = string
  default = ""
}

variable "files_bucket_suffix" {
  type    = string
  default = "-files"
}

variable "front_bucket_suffix" {
  type    = string
  default = "-front"
}

variable "oac_name_suffix" {
  type    = string
  default = "-s3-oac"
}
