"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminNav() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="admin-nav">
      <div>
        <strong>Dental Booking — Admin</strong>
      </div>
      <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <Link href="/admin">Tenants</Link>
        <Link href="/admin/tenants/new">New tenant</Link>
        <button
          type="button"
          className="admin-btn admin-btn-ghost"
          onClick={() => void logout()}
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}
