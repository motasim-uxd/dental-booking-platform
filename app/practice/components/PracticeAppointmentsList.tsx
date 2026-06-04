"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PracticeAppointmentRow } from "@/lib/practice/pms-appointments";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function channelLabel(channel: string | null): string {
  if (!channel) return "—";
  const c = channel.toLowerCase();
  if (c === "web") return "Web form";
  if (c === "voice" || c === "lex") return "Voice";
  return channel;
}

type Props = {
  initial: PracticeAppointmentRow[];
  integrationMode: string;
  tenantSlug: string;
  webFormEnabled: boolean;
};

export default function PracticeAppointmentsList({
  initial,
  integrationMode,
  tenantSlug,
  webFormEnabled,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/practice/appointments", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "Could not refresh appointments");
        return;
      }
      setRows(Array.isArray(json?.appointments) ? json.appointments : []);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
          Integration: <strong>{integrationMode}</strong>
          {integrationMode === "dual"
            ? " — includes appointments mirrored from Oryx bookings"
            : " — platform database is your schedule"}
        </p>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      {rows.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6 }}>
          <p>No appointments yet.</p>
          {webFormEnabled ? (
            <p>
              Book via the{" "}
              <a href={`/book/${tenantSlug}`} target="_blank" rel="noreferrer">
                web form
              </a>{" "}
              or voice — they will appear here after a successful booking.
            </p>
          ) : (
            <p>Enable web booking or use voice/Lex to create appointments in internal PMS mode.</p>
          )}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Patient</th>
                <th>Type</th>
                <th>Op</th>
                <th>Provider</th>
                <th>Channel</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{formatWhen(a.startsAt)}</td>
                  <td>
                    {a.patient.firstName} {a.patient.lastName}
                    <br />
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      {a.patient.phoneNumber}
                    </span>
                  </td>
                  <td>{a.apptType}</td>
                  <td>{a.operatoryId}</td>
                  <td>{a.providerName ?? "—"}</td>
                  <td>{channelLabel(a.channel)}</td>
                  <td>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
