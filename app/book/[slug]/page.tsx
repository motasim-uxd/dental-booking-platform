import { notFound } from "next/navigation";
import BookStaticShell from "../components/BookStaticShell";
import BookingWizardClient from "../components/BookingWizardClient";
import WebFormUnavailable from "../components/WebFormUnavailable";
import {
  getEffectiveAccessCode,
  loadBookingContext,
  tenantFeatures,
} from "@/lib/booking/context";
import { tenantBookBranding } from "@/lib/booking/tenant-branding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string | string[] }>;
};

export default async function TenantBookPage({ params, searchParams }: Props) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.trim().toLowerCase();
  const ctx = await loadBookingContext(slug);

  if (!ctx) notFound();

  if (ctx.tenant.status === "suspended") {
    notFound();
  }

  const branding = tenantBookBranding(ctx.tenant);
  const features = tenantFeatures(ctx.tenant);

  if (features.webForm === false) {
    return <WebFormUnavailable branding={branding} />;
  }

  const sp = await searchParams;
  const raw = sp?.code;
  const initialPreviewCode = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const requiresAccessCode = Boolean(getEffectiveAccessCode(ctx.tenant));

  return (
    <>
      <noscript>
        <p style={{ padding: "1.25rem", fontFamily: "system-ui, sans-serif" }}>
          JavaScript is required for online scheduling.
          {branding.phone ? ` Call us at ${branding.phone}.` : ""}
        </p>
      </noscript>
      <BookStaticShell
        branding={branding}
        initialPreviewCode={initialPreviewCode}
        requiresAccessCode={requiresAccessCode}
      />
      <BookingWizardClient
        tenantSlug={slug}
        branding={branding}
        requiresAccessCode={requiresAccessCode}
        initialPreviewCode={initialPreviewCode}
      />
    </>
  );
}
