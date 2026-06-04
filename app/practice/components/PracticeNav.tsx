"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  email: string;
  showSchedule: boolean;
  active?: "dashboard" | "appointments";
};

export default function PracticeNav({ email, showSchedule, active = "dashboard" }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/practice/logout", { method: "POST" });
    router.push("/practice/login");
    router.refresh();
  }

  return (
    <header
      style={{
        background: "#0f2840",
        color: "#fff",
        padding: "0.75rem 1.25rem",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem 1.25rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <nav style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <strong>Practice portal</strong>
          <Link
            href="/practice"
            style={{
              color: "#fff",
              fontSize: "0.9rem",
              opacity: active === "dashboard" ? 1 : 0.75,
              fontWeight: active === "dashboard" ? 600 : 400,
            }}
          >
            Dashboard
          </Link>
          {showSchedule ? (
            <Link
              href="/practice/appointments"
              style={{
                color: "#fff",
                fontSize: "0.9rem",
                opacity: active === "appointments" ? 1 : 0.75,
                fontWeight: active === "appointments" ? 600 : 400,
              }}
            >
              Appointments
            </Link>
          ) : null}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.85rem" }}>{email}</span>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
