-- CreateEnum
CREATE TYPE "IntegrationMode" AS ENUM ('external_only', 'internal_only', 'dual');

-- AlterTable
ALTER TABLE "tenant_pms_config" ADD COLUMN     "dual_booking_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "integration_mode" "IntegrationMode" NOT NULL DEFAULT 'external_only';
