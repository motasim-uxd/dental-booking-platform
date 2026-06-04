# FastAPI middleware + diagram async/data layers (DEV/PROD via local.name)

resource "aws_cloudwatch_log_group" "fastapi" {
  name              = "/ecs/${local.name}-fastapi"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_service_discovery_private_dns_namespace" "platform" {
  name = "${local.name}.local"
  vpc  = module.vpc.vpc_id
  tags = local.tags
}

resource "aws_service_discovery_service" "fastapi" {
  name = "fastapi"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.platform.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = local.tags
}

resource "aws_security_group_rule" "ecs_fastapi_ingress" {
  type                     = "ingress"
  from_port                = 8001
  to_port                  = 8001
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs.id
  source_security_group_id = aws_security_group.ecs.id
  description              = "Next.js ECS to FastAPI middleware"
}

resource "aws_dynamodb_table" "conversation_sessions" {
  name         = "${local.name}-conversation-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }

  tags = local.tags
}

resource "aws_sqs_queue" "appointment_writeback" {
  name                       = "${local.name}-appointment-writeback"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 86400
  tags                       = local.tags
}

resource "aws_sqs_queue" "notifications" {
  name                       = "${local.name}-notifications"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 86400
  tags                       = local.tags
}

data "aws_iam_policy_document" "platform_data" {
  statement {
    actions = [
      "bedrock:InvokeModel",
      "bedrock:Converse",
    ]
    resources = ["*"]
  }

  statement {
    actions = [
      "sqs:SendMessage",
      "sqs:GetQueueUrl",
    ]
    resources = [
      aws_sqs_queue.appointment_writeback.arn,
      aws_sqs_queue.notifications.arn,
    ]
  }

  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
    ]
    resources = [aws_dynamodb_table.conversation_sessions.arn]
  }
}

resource "aws_iam_policy" "platform_data" {
  name   = "${local.name}-platform-data"
  policy = data.aws_iam_policy_document.platform_data.json
  tags   = local.tags
}

resource "aws_iam_role_policy_attachment" "task_platform_data" {
  role       = aws_iam_role.task.name
  policy_arn = aws_iam_policy.platform_data.arn
}

resource "aws_ecs_task_definition" "fastapi" {
  count = var.enable_fastapi_service && var.fastapi_image != "" ? 1 : 0

  family                   = "${local.name}-fastapi"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "fastapi"
      image     = var.fastapi_image
      essential = true
      portMappings = [
        { containerPort = 8001, hostPort = 8001, protocol = "tcp" }
      ]
      environment = [
        { name = "FASTAPI_PORT", value = "8001" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "DYNAMODB_CONVERSATION_TABLE", value = aws_dynamodb_table.conversation_sessions.name },
        { name = "SQS_APPOINTMENT_WRITEBACK_URL", value = aws_sqs_queue.appointment_writeback.url },
        { name = "SQS_NOTIFICATIONS_URL", value = aws_sqs_queue.notifications.url },
      ]
      secrets = [
        { name = "APP_ENV_JSON", valueFrom = aws_secretsmanager_secret.app_env.arn },
        { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.app_env.arn}:DATABASE_URL::" },
        { name = "S2S_SHARED_SECRET", valueFrom = "${aws_secretsmanager_secret.app_env.arn}:S2S_SHARED_SECRET::" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.fastapi.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "fastapi"
        }
      }
    }
  ])

  tags = local.tags
}

resource "aws_ecs_service" "fastapi" {
  count = var.enable_fastapi_service && var.fastapi_image != "" ? 1 : 0

  name            = "${local.name}-fastapi"
  cluster         = aws_ecs_cluster.app.id
  task_definition = aws_ecs_task_definition.fastapi[0].arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.fastapi.arn
  }

  tags = local.tags
}
