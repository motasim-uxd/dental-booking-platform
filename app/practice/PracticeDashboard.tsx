"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  email: string;
  tenant: {
    slug: string;
    name: string;
    status: string;
    features: { voice?: boolean; webForm?: boolean; webFormRequestedAt?: string };
  };
};

export default function PracticeDashboard({ email, tenant }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const features = tenant.features ?? {};
  const webFormRequested = Boolean(features.webFormRequestedAt);

  async function logout() {
    await fetch("/api/practice/logout", { method: "POST" });
    router.push("/practice/login");
    router.refresh();
  }

  async function requestWebForm() {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/practice/request-web-form", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Request failed");
        return;
      }
      setMsg("Web form request sent. Our team will enable it after review.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header
        style={{
          background: "#0f2840",
          color: "#fff",
          padding: "0.75rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>Practice portal</strong>
        <span style={{ fontSize: "0.85rem" }}>{email}</span>
        <button type="button" className="admin-btn admin-btn-ghost" onClick={() => void logout()}>
          Sign out
        </button>
      </header>
      <main className="admin-main">
        <div className="admin-card">
          <h2>{tenant.name}</h2>
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
            Slug: <code>{tenant.slug}</code> · Status: <strong>{tenant.status}</strong>
          </p>
          <ul style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
            <li>
              Voice booking:{" "}
              <strong>{features.voice !== false ? "on" : "off"}</strong> (Connect/Lex — ops maps
              your DID)
            </li>
            <li>
              Web booking form:{" "}
              <strong>{features.webForm ? "on" : "off"}</strong>
              {features.webForm ? (
                <>
                  {" "}
                  —{" "}
                  <Link href={`/book/${tenant.slug}`} target="_blank">
                    Open form
                  </Link>
                </>
              ) : null}
            </li>
          </ul>
          {error ? <p className="admin-error">{error}</p> : null}
          {msg ? <p style={{ color: "#166534", fontSize: "0.9rem" }}>{msg}</p> : null}
          {!features.webForm && !webFormRequested ? (
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={busy}
              onClick={() => void requestWebForm()}
            >
              {busy ? "Sending…" : "Request web booking form add-on"}
            </button>
          ) : null}
          {!features.webForm && webFormRequested ? (
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
              Web form requested on {new Date(features.webFormRequestedAt!).toLocaleString()}.
              Pending approval.
            </p>
          ) : null}
        </div>
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>Next steps</h3>
          <ol style={{ fontSize: "0.9rem", color: "#334155", lineHeight: 1.6 }}>
            <li>Platform ops maps your AWS Connect phone number to the booking bot.</li>
            <li>Configure Oryx realm and operatory rules (platform admin).</li>
            <li>Test voice by calling your practice line once Connect is live.</li>
          </ol>
        </div>
      </main>
    </>
  );
}
