-- CreateEnum
CREATE TYPE "PlatformUserRole" AS ENUM ('practice_admin');

-- CreateTable
CREATE TABLE "platform_users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "PlatformUserRole" NOT NULL DEFAULT 'practice_admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_tenant_id_key" ON "platform_users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- AddForeignKey
ALTER TABLE "platform_users" ADD CONSTRAINT "platform_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
