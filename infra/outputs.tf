output "alb_dns_name" {
  value       = aws_lb.app.dns_name
  description = "Public ALB DNS name"
}

output "api_base_url" {
  value       = "http://${aws_lb.app.dns_name}"
  description = "Base URL for the service (HTTP only until ACM/HTTPS is added)"
}

output "book_preview_url" {
  value       = "http://${aws_lb.app.dns_name}/book?code=SSQ-PREVIEW-2026"
  description = "Shareable web booking URL (must use http:// — port 443 is not open yet)"
}

output "ecr_repository_url" {
  value       = aws_ecr_repository.app.repository_url
  description = "ECR repository URL"
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.app.name
  description = "ECS cluster name (for aws ecs update-service)"
}

output "ecs_service_name" {
  value       = aws_ecs_service.app.name
  description = "ECS service name (for aws ecs update-service)"
}

output "secretsmanager_env_secret_arn" {
  value       = aws_secretsmanager_secret.app_env.arn
  description = "Secret ARN where runtime env JSON should be stored"
}

