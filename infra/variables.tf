variable "project_name" {
  type        = string
  description = "Name prefix for all resources"
  default     = "oryx-agent"
}

variable "environment" {
  type        = string
  description = "Deployment environment name (dev|prod)"
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be one of: dev, prod"
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region to deploy into"
  default     = "us-east-1"
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR"
  default     = "10.50.0.0/20"
}

variable "app_image" {
  type        = string
  description = "Container image URI (ECR) for the service"
}

variable "desired_count" {
  type        = number
  description = "Number of tasks"
  default     = 1
}

variable "task_cpu" {
  type        = number
  description = "Fargate CPU units"
  default     = 512
}

variable "task_memory" {
  type        = number
  description = "Fargate memory (MiB)"
  default     = 1024
}

variable "tags" {
  type        = map(string)
  description = "Extra tags"
  default     = {}
}

variable "fastapi_image" {
  type        = string
  description = "FastAPI middleware container image (ECR tag fastapi-dev)"
  default     = ""
}

variable "enable_fastapi_service" {
  type        = bool
  description = "Run FastAPI ECS service with Cloud Map DNS fastapi.<cluster>.local:8001"
  default     = false
}

