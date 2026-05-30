import type { TenantBookBranding } from "@/lib/booking/tenant-branding";
import { phoneTelHref } from "@/lib/booking/tenant-branding";

export default function WebFormUnavailable({ branding }: { branding: TenantBookBranding }) {
  const tel = phoneTelHref(branding.phone);

  return (
    <div className="ss-book" style={{ minHeight: "100dvh", background: "#fff" }}>
      <header className="ss-topbar">
        <div className="ss-topbar-inner">
          {branding.address ? <span>{branding.address}</span> : null}
          {branding.phone ? (
            <span>
              Call us at{" "}
              {tel ? (
                <a href={tel} style={{ color: "inherit" }}>
                  {branding.phone}
                </a>
              ) : (
                branding.phone
              )}
            </span>
          ) : null}
        </div>
      </header>
      <header className="ss-header">
        <div className="ss-brand-title">{branding.displayName}</div>
        {branding.tagline ? <div className="ss-brand-sub">{branding.tagline}</div> : null}
      </header>
      <main className="ss-main">
        <div className="ss-card" style={{ maxWidth: "32rem", margin: "0 auto" }}>
          <h2>Online scheduling</h2>
          <p className="ss-lead">
            Web booking is not enabled for this practice. Please call the office to schedule an
            appointment.
          </p>
          {branding.phone ? (
            <p style={{ marginTop: "1rem" }}>
              <a href={tel || undefined} className="ss-btn ss-btn-primary" style={{ display: "inline-block" }}>
                Call {branding.phone}
              </a>
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
