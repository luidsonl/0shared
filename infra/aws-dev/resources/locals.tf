locals {
  name_prefix = "${var.project_name}-${var.environment}"
  full_prefix = "${var.namespace}-${var.project_name}-${var.environment}"
}
