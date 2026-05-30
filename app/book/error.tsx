"use client";

export default function BookError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="ss-book-root" style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.25rem" }}>Scheduling temporarily unavailable</h1>
      <p style={{ color: "#334155" }}>
        {error.message || "Something went wrong loading the form."}
      </p>
      <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
        Try refreshing, or call +1 (717) 884-8807. Open the link in Safari or Chrome with Wi‑Fi or
        cellular data.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          marginTop: "1rem",
          padding: "0.6rem 1.2rem",
          background: "#1a3d5c",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          fontWeight: 600,
        }}
      >
        Try again
      </button>
    </div>
  );
}
