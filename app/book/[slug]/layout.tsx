import type { Metadata } from "next";
import { loadBookingContext } from "@/lib/booking/context";
import { tenantBookBranding } from "@/lib/booking/tenant-branding";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await loadBookingContext(slug.trim().toLowerCase());
  if (!ctx) {
    return { title: "Book an appointment" };
  }
  const branding = tenantBookBranding(ctx.tenant);
  return {
    title: `Book an appointment | ${branding.practiceName}`,
    description: `Schedule a visit online with ${branding.practiceName}.`,
  };
}

export default function TenantBookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
