import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPracticeSessionUser } from "@/lib/practice/auth";
import {
  getTenantIntegrationMode,
  usesInternalPmsSchedule,
} from "@/lib/practice/pms-appointments";
import PracticeDashboard from "./PracticeDashboard";

export const dynamic = "force-dynamic";

export default async function PracticeHomePage() {
  const user = await getPracticeSessionUser();
  if (!user) redirect("/practice/login");

  const features = (user.tenant.features ?? {}) as {
    voice?: boolean;
    webForm?: boolean;
    webFormRequestedAt?: string;
  };

  const integrationMode = await getTenantIntegrationMode(user.tenantId);
  const showSchedule = usesInternalPmsSchedule(integrationMode);
  const appointmentCount = showSchedule
    ? await prisma.appointment.count({ where: { tenantId: user.tenantId } })
    : 0;

  return (
    <PracticeDashboard
      email={user.email}
      showSchedule={showSchedule}
      appointmentCount={appointmentCount}
      tenant={{
        slug: user.tenant.slug,
        name: user.tenant.name,
        status: user.tenant.status,
        features,
      }}
    />
  );
}
