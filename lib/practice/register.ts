import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { createTenant, isValidSlug, normalizeSlug } from "@/lib/admin/tenant-admin";
import { hashPassword } from "@/lib/practice/password";

export type RegisterPracticeInput = {
  email: string;
  password: string;
  practiceName: string;
  slug?: string;
  pmsType?: "oryx";
  oryxRealm?: string;
};

function slugFromName(name: string): string {
  return normalizeSlug(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

export async function registerPractice(input: RegisterPracticeInput) {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Valid email required");
  if (!input.password || input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  if (!input.practiceName?.trim()) throw new Error("Practice name required");

  const existingEmail = await prisma.platformUser.findUnique({ where: { email } });
  if (existingEmail) throw new Error("An account with this email already exists");

  let slug = input.slug?.trim() ? normalizeSlug(input.slug) : slugFromName(input.practiceName);
  if (!isValidSlug(slug)) {
    throw new Error("Invalid URL slug (use lowercase letters, numbers, hyphens)");
  }

  const slugTaken = await prisma.tenant.findUnique({ where: { slug } });
  if (slugTaken) throw new Error("This practice URL is already taken — try a different slug");

  const tenant = await createTenant({
    slug,
    name: input.practiceName.trim(),
    status: "trial",
    features: { voice: true, webForm: false },
    oryxRealm: input.oryxRealm?.trim() || slug,
    pmsType: input.pmsType ?? "oryx",
  });

  const user = await prisma.platformUser.create({
    data: {
      tenantId: tenant.id,
      email,
      passwordHash: hashPassword(input.password),
      role: "practice_admin",
    },
  });

  return { tenant, user };
}

export async function requestWebFormAddOn(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return null;

  const features = (tenant.features ?? {}) as Record<string, unknown>;
  const updated = {
    ...features,
    webFormRequestedAt: new Date().toISOString(),
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { features: updated as Prisma.InputJsonValue },
  });

  return updated;
}
