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

output "fastapi_internal_url" {
  value       = "http://fastapi.${aws_service_discovery_private_dns_namespace.platform.name}:8001"
  description = "Set FASTAPI_BASE_URL in Secrets Manager for Next.js → middleware"
}

output "sqs_appointment_writeback_url" {
  value = aws_sqs_queue.appointment_writeback.url
}

output "sqs_notifications_url" {
  value = aws_sqs_queue.notifications.url
}

output "dynamodb_conversation_table" {
  value = aws_dynamodb_table.conversation_sessions.name
}

output "ecs_fastapi_service_name" {
  value       = length(aws_ecs_service.fastapi) > 0 ? aws_ecs_service.fastapi[0].name : ""
  description = "FastAPI ECS service name when enabled"
}

