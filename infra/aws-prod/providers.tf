provider "aws" {
  region = var.region

  default_tags {
    tags = {
      "env"     = var.environment
      "project" = var.project_name
      "manager" = "terraform"
      "owner"   = var.owner != null ? var.owner : "unknown"
    }
  }
}
