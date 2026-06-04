-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'failed');

-- AlterTable
ALTER TABLE "tenants" ALTER COLUMN "features" SET DEFAULT '{"voice":true,"webForm":false}';

-- CreateTable
CREATE TABLE "booking_attempts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "external_id" TEXT,
    "request_payload" JSONB NOT NULL DEFAULT '{}',
    "response_body" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_attempts_tenant_id_created_at_idx" ON "booking_attempts"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_attempts_tenant_id_idempotency_key_key" ON "booking_attempts"("tenant_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "booking_attempts" ADD CONSTRAINT "booking_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
