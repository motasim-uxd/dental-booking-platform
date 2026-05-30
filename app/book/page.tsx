import { redirect } from "next/navigation";
import { DEFAULT_TENANT_SLUG } from "@/lib/booking/context";

type Props = {
  searchParams: Promise<{ code?: string | string[] }>;
};

/** Legacy `/book` → default tenant slug (Smile Squad). */
export default async function BookRedirectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = sp?.code;
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const qs = code ? `?code=${encodeURIComponent(code)}` : "";
  redirect(`/book/${DEFAULT_TENANT_SLUG}${qs}`);
}
