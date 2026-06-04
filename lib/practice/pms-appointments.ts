import { prisma } from "@/lib/db";
import type { IntegrationMode } from "@/lib/tenant/types";

export type PracticeAppointmentRow = {
  id: string;
  status: string;
  apptType: string;
  reason: string | null;
  channel: string | null;
  operatoryId: number;
  startsAt: string;
  endsAt: string;
  patient: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  providerName: string | null;
};

export async function getTenantIntegrationMode(
  tenantId: string
): Promise<IntegrationMode> {
  const cfg = await prisma.tenantPmsConfig.findUnique({
    where: { tenantId },
    select: { integrationMode: true },
  });
  const mode = cfg?.integrationMode ?? "external_only";
  if (mode === "internal_only" || mode === "dual") return mode;
  return "external_only";
}

export function usesInternalPmsSchedule(mode: IntegrationMode): boolean {
  return mode === "internal_only" || mode === "dual";
}

/** Appointments stored in platform DB (internal PMS + dual mirror). */
export async function listPracticeAppointments(
  tenantId: string,
  options?: { limit?: number }
): Promise<PracticeAppointmentRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const rows = await prisma.appointment.findMany({
    where: { tenantId },
    include: {
      patient: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phoneNumber: true,
        },
      },
      provider: { select: { displayName: true } },
    },
    orderBy: { startsAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    apptType: r.apptType,
    reason: r.reason,
    channel: r.channel,
    operatoryId: r.operatoryId,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    patient: r.patient,
    providerName: r.provider?.displayName ?? null,
  }));
}
