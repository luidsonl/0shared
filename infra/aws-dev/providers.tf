provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      "env"     = "dev"
      "project" = "0shared"
      "manager" = "terraform"
      "owner"   = "luidsonl"
    }
  }
}
