import { NextResponse } from "next/server";
import { loadBookingContext, tenantFeatures } from "@/lib/booking/context";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { slug } = await context.params;
  const ctx = await loadBookingContext(slug);

  if (!ctx) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  if (ctx.tenant.status === "suspended") {
    return NextResponse.json({ error: "Tenant suspended" }, { status: 403 });
  }

  const features = tenantFeatures(ctx.tenant);

  return NextResponse.json({
    slug: ctx.tenant.slug,
    name: ctx.tenant.name,
    branding: ctx.tenant.branding,
    features,
    requiresAccessCode: Boolean(ctx.tenant.webFormAccessCode?.trim()),
    pmsType: ctx.adapter.pmsType,
  });
}
