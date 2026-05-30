"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PracticeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/practice/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error ?? "Login failed");
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
      <div className="admin-card">
        <h2 style={{ marginTop: 0, color: "#0f2840" }}>Practice login</h2>
        <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
          Manage your practice settings and add-on requests.
        </p>
        <form onSubmit={onSubmit}>
          <div className="admin-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="admin-error">{error}</p> : null}
          <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
          New practice? <Link href="/practice/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
