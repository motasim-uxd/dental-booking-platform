import Link from "next/link";

export default function Home() {
  return (
    <div style={{ maxWidth: 760, margin: "40px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>Oryx Scheduling Agent</h1>
      <p style={{ color: "#555" }}>
        Chat-based online scheduling for the Smile Squad Oryx realm (<b>smilesquadpd</b>).
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <Link
          href="/schedule"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 10,
            background: "#111",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          Open chat scheduler
        </Link>
        <Link
          href="/book"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "#fff",
            color: "#111",
            textDecoration: "none",
          }}
        >
          Web booking form
        </Link>
      </div>
    </div>
  );
}
