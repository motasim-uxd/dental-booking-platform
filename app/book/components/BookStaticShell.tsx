/**
 * Server-rendered HTML so mobile sees content before the client JS bundle runs.
 * Hidden when wizard UI paints (see booking.css .ss-wizard-ready).
 */
import type { TenantBookBranding } from "@/lib/booking/tenant-branding";

export default function BookStaticShell({
  branding,
  initialPreviewCode,
  requiresAccessCode = false,
}: {
  branding: TenantBookBranding;
  initialPreviewCode: string;
  requiresAccessCode?: boolean;
}) {
  const hasCode = Boolean(initialPreviewCode.trim());
  const buildId = process.env.NEXT_PUBLIC_BUILD_ID?.trim() || "";
  const showCodeHint = requiresAccessCode && !hasCode;

  return (
    <div
      className="ss-book ss-ssr-fallback"
      aria-hidden="false"
      style={{
        minHeight: "100dvh",
        background: "#fff",
        color: "#0f2840",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <header
        style={{
          background: "#0f2840",
          color: "#fff",
          fontSize: "0.75rem",
          padding: "0.5rem 1.25rem",
        }}
      >
        <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
          {branding.address ? <span>{branding.address}</span> : null}
          {branding.phone ? (
            <span style={{ display: branding.address ? "block" : undefined }}>
              Call us at {branding.phone}
            </span>
          ) : null}
        </div>
      </header>
      <header style={{ textAlign: "center", padding: "1.25rem 1rem 0.5rem" }}>
        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#1a3d5c" }}>
          {branding.displayName}
        </div>
        {branding.tagline ? (
          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#2d6da8", marginTop: "0.15rem" }}>
            {branding.tagline}
          </div>
        ) : null}
      </header>

      <main style={{ maxWidth: "56rem", margin: "0 auto", padding: "1.5rem 1.25rem 3rem" }}>
        <div
          style={{
            maxWidth: "36rem",
            margin: "0 auto",
            background: "#f6f8fa",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "1.5rem",
          }}
        >
          {showCodeHint ? (
            <>
              <h2>Online scheduling</h2>
              <p className="ss-lead">Loading the booking form…</p>
              <p style={{ margin: "0 0 1rem", color: "#64748b", fontSize: "0.85rem" }}>
                If this screen stays blank, open the full link in Safari or Chrome (not only inside
                a messaging app). The link must include your access code after{" "}
                <strong>?code=</strong>
              </p>
            </>
          ) : (
            <>
              <h2>Welcome</h2>
              <p className="ss-lead">Loading appointment options…</p>
              <p style={{ color: "#64748b", fontSize: "0.9rem", margin: 0 }}>
                Patient types and visit types will appear in a moment.
              </p>
            </>
          )}
          <p
            className="ss-ssr-spinner"
            role="status"
            aria-live="polite"
            style={{ marginTop: "1.25rem", textAlign: "center", color: "#1a3d5c", fontWeight: 600 }}
          >
            Please wait…
          </p>
          {branding.phone ? (
            <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b", textAlign: "center" }}>
              If this does not change within 30 seconds, refresh the page or call {branding.phone}.
            </p>
          ) : null}
          {buildId ? (
            <p style={{ marginTop: "1rem", fontSize: "0.7rem", color: "#94a3b8", textAlign: "center" }}>
              Build {buildId}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
