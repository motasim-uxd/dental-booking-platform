import { notFound } from "next/navigation";
import AdminNav from "../../components/AdminNav";
import { getTenantDetail } from "@/lib/admin/tenant-admin";
import TenantManageClient from "./TenantManageClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TenantManagePage({ params }: Props) {
  const { id } = await params;
  const tenant = await getTenantDetail(id);
  if (!tenant) notFound();

  return (
    <>
      <AdminNav />
      <TenantManageClient tenant={JSON.parse(JSON.stringify(tenant))} />
    </>
  );
}
