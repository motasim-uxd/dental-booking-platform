"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminNav from "../../components/AdminNav";

export default function NewTenantPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      slug: String(fd.get("slug") ?? ""),
      name: String(fd.get("name") ?? ""),
      oryxRealm: String(fd.get("oryxRealm") ?? ""),
      features: {
        voice: fd.get("voice") === "on",
        webForm: fd.get("webForm") === "on",
      },
      webFormAccessCode: String(fd.get("webFormAccessCode") ?? "") || null,
    };

    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Create failed");
        return;
      }
      router.push(`/admin/tenants/${json.tenant.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminNav />
      <main className="admin-main">
        <div className="admin-card">
          <h2>New practice (tenant)</h2>
          <p style={{ fontSize: "0.9rem", color: "#64748b" }}>
            Creates tenant with default booking bot (Amy). Voice on by default; web form off until
            enabled.
          </p>
          <form onSubmit={onSubmit}>
            <div className="admin-grid-2">
              <div className="admin-field">
                <label htmlFor="name">Practice name</label>
                <input id="name" name="name" required />
              </div>
              <div className="admin-field">
                <label htmlFor="slug">URL slug</label>
                <input id="slug" name="slug" placeholder="smilesquad" required />
              </div>
              <div className="admin-field">
                <label htmlFor="oryxRealm">Oryx realm</label>
                <input id="oryxRealm" name="oryxRealm" placeholder="smilesquadpd" />
              </div>
              <div className="admin-field">
                <label htmlFor="webFormAccessCode">Web form access code (optional)</label>
                <input id="webFormAccessCode" name="webFormAccessCode" />
              </div>
            </div>
            <div className="admin-field">
              <label>
                <input type="checkbox" name="voice" defaultChecked /> Voice booking (Connect/Lex)
              </label>
            </div>
            <div className="admin-field">
              <label>
                <input type="checkbox" name="webForm" /> Web booking form add-on
              </label>
            </div>
            {error ? <p className="admin-error">{error}</p> : null}
            <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
              {busy ? "Creating…" : "Create tenant"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
