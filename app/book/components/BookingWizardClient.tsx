"use client";

import { useEffect, useState } from "react";
import type { TenantBookBranding } from "@/lib/booking/tenant-branding";
import BookingWizard from "./BookingWizard";

type Props = {
  tenantSlug: string;
  branding: TenantBookBranding;
  requiresAccessCode?: boolean;
  initialPreviewCode?: string;
};

/**
 * Wait until after mount before rendering the wizard so server HTML (shell) matches
 * client hydration. Wizard is statically imported so we do not depend on a second
 * lazy chunk that can leave the page stuck on "Please wait…".
 */
export default function BookingWizardClient({
  tenantSlug,
  branding,
  requiresAccessCode = false,
  initialPreviewCode = "",
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <BookingWizard
      tenantSlug={tenantSlug}
      branding={branding}
      requiresAccessCode={requiresAccessCode}
      initialPreviewCode={initialPreviewCode}
    />
  );
}
