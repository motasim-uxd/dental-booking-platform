"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PracticeRegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/practice/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(fd.get("email") ?? ""),
          password: String(fd.get("password") ?? ""),
          practiceName: String(fd.get("practiceName") ?? ""),
          slug: String(fd.get("slug") ?? "") || undefined,
          oryxRealm: String(fd.get("oryxRealm") ?? "") || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Registration failed");
        return;
      }
      router.push("/practice");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-card" style={{ maxWidth: "32rem" }}>
        <h2 style={{ marginTop: 0, color: "#0f2840" }}>Register your practice</h2>
        <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
          Voice booking (Amy) is included. Web booking form is off until you request it and we
          approve.
        </p>
        <form onSubmit={onSubmit}>
          <div className="admin-field">
            <label htmlFor="practiceName">Practice name</label>
            <input id="practiceName" name="practiceName" required />
          </div>
          <div className="admin-field">
            <label htmlFor="slug">URL slug (optional)</label>
            <input id="slug" name="slug" placeholder="my-clinic" />
          </div>
          <div className="admin-field">
            <label htmlFor="oryxRealm">Oryx realm (optional)</label>
            <input id="oryxRealm" name="oryxRealm" placeholder="myclinicpd" />
          </div>
          <div className="admin-field">
            <label htmlFor="email">Your email (practice admin)</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="admin-field">
            <label htmlFor="password">Password (min 8 characters)</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {error ? <p className="admin-error">{error}</p> : null}
          <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
          Already registered? <Link href="/practice/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
