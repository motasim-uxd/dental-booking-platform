import Link from "next/link";
import AdminNav from "./components/AdminNav";
import { listTenants } from "@/lib/admin/tenant-admin";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const tenants = await listTenants();

  return (
    <>
      <AdminNav />
      <main className="admin-main">
        <div className="admin-card">
          <h2>Practices (tenants)</h2>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            Default product: one booking bot (Amy). Enable web form or extra bots per practice.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Voice</th>
                <th>Web form</th>
                <th>Bots</th>
                <th>DIDs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const features = (t.features ?? {}) as { voice?: boolean; webForm?: boolean };
                return (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>
                      <code>{t.slug}</code>
                    </td>
                    <td>{t.status}</td>
                    <td>
                      <span
                        className={`admin-badge ${features.voice !== false ? "admin-badge-on" : "admin-badge-off"}`}
                      >
                        {features.voice !== false ? "on" : "off"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`admin-badge ${features.webForm ? "admin-badge-on" : "admin-badge-off"}`}
                      >
                        {features.webForm ? "on" : "off"}
                      </span>
                    </td>
                    <td>{t._count.bots}</td>
                    <td>{t._count.phoneNumbers}</td>
                    <td>
                      <Link href={`/admin/tenants/${t.id}`}>Manage</Link>
                      {" · "}
                      <Link href={`/book/${t.slug}`} target="_blank">
                        Book
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!tenants.length ? (
            <p style={{ marginTop: "1rem" }}>No tenants yet. Create one to get started.</p>
          ) : null}
        </div>
      </main>
    </>
  );
}
