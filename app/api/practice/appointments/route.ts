import { NextResponse } from "next/server";
import { getPracticeSessionUser } from "@/lib/practice/auth";
import {
  getTenantIntegrationMode,
  listPracticeAppointments,
  usesInternalPmsSchedule,
} from "@/lib/practice/pms-appointments";
import { isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const user = await getPracticeSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integrationMode = await getTenantIntegrationMode(user.tenantId);
  if (!usesInternalPmsSchedule(integrationMode)) {
    return NextResponse.json({
      integrationMode,
      appointments: [],
      message:
        "Your practice uses an external PMS. Appointments are stored in Oryx, not in the platform schedule.",
    });
  }

  const appointments = await listPracticeAppointments(user.tenantId);
  return NextResponse.json({
    integrationMode,
    tenantSlug: user.tenant.slug,
    appointments,
  });
}
