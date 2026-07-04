terraform {
  backend "s3" {
    bucket       = "luidsonl-0shared-terraform-state"
    key          = "infra/aws/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
