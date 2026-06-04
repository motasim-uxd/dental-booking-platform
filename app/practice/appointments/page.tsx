import Link from "next/link";
import { redirect } from "next/navigation";
import { getPracticeSessionUser } from "@/lib/practice/auth";
import {
  getTenantIntegrationMode,
  listPracticeAppointments,
  usesInternalPmsSchedule,
} from "@/lib/practice/pms-appointments";
import PracticeNav from "../components/PracticeNav";
import PracticeAppointmentsList from "../components/PracticeAppointmentsList";

export const dynamic = "force-dynamic";

export default async function PracticeAppointmentsPage() {
  const user = await getPracticeSessionUser();
  if (!user) redirect("/practice/login");

  const integrationMode = await getTenantIntegrationMode(user.tenantId);
  const showSchedule = usesInternalPmsSchedule(integrationMode);
  const features = (user.tenant.features ?? {}) as { webForm?: boolean };

  return (
    <>
      <PracticeNav email={user.email} showSchedule={showSchedule} active="appointments" />
      <main className="admin-main">
        <div className="admin-card">
          <h2 style={{ marginTop: 0 }}>Appointments</h2>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            {user.tenant.name} · <code>{user.tenant.slug}</code>
          </p>

          {!showSchedule ? (
            <div style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "#334155" }}>
              <p>
                This practice uses an <strong>external PMS</strong> (e.g. Oryx). Bookings are
                written there, not into the platform appointment calendar.
              </p>
              <p>
                To use the built-in schedule, platform admin must set integration mode to{" "}
                <code>internal_only</code> (or <code>dual</code> for mirror).
              </p>
              <Link href="/practice" className="admin-btn admin-btn-ghost" style={{ display: "inline-block" }}>
                Back to dashboard
              </Link>
            </div>
          ) : (
            <PracticeAppointmentsList
              initial={await listPracticeAppointments(user.tenantId)}
              integrationMode={integrationMode}
              tenantSlug={user.tenant.slug}
              webFormEnabled={Boolean(features.webForm)}
            />
          )}
        </div>
      </main>
    </>
  );
}
