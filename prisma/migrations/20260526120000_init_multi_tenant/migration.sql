-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'trial');

-- CreateEnum
CREATE TYPE "PmsType" AS ENUM ('oryx', 'open_dental', 'dentrix', 'custom_api');

-- CreateEnum
CREATE TYPE "BotType" AS ENUM ('booking', 'admin', 'faq', 'other');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "features" JSONB NOT NULL DEFAULT '{"voice":true,"webForm":true}',
    "branding" JSONB NOT NULL DEFAULT '{}',
    "max_bots" INTEGER NOT NULL DEFAULT 8,
    "web_form_access_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_pms_config" (
    "tenant_id" UUID NOT NULL,
    "pms_type" "PmsType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "operatory_rules" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pms_config_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "tenant_bots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bot_key" TEXT NOT NULL,
    "bot_type" "BotType" NOT NULL,
    "lex_bot_id" TEXT,
    "lex_bot_alias" TEXT,
    "lambda_arn" TEXT,
    "connect_flow_arn" TEXT,
    "prompts_config" JSONB NOT NULL DEFAULT '{}',
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_phone_numbers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "bot_id" UUID NOT NULL,
    "e164" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "tenant_id" UUID NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "plan_id" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'incomplete',
    "current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_bots_tenant_id_bot_key_key" ON "tenant_bots"("tenant_id", "bot_key");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_phone_numbers_e164_key" ON "tenant_phone_numbers"("e164");

-- AddForeignKey
ALTER TABLE "tenant_pms_config" ADD CONSTRAINT "tenant_pms_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_bots" ADD CONSTRAINT "tenant_bots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_phone_numbers" ADD CONSTRAINT "tenant_phone_numbers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_phone_numbers" ADD CONSTRAINT "tenant_phone_numbers_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "tenant_bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
