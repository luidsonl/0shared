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
