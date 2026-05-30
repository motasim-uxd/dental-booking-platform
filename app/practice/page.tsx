import { redirect } from "next/navigation";
import { getPracticeSessionUser } from "@/lib/practice/auth";
import PracticeDashboard from "./PracticeDashboard";

export const dynamic = "force-dynamic";

export default async function PracticeHomePage() {
  const user = await getPracticeSessionUser();
  if (!user) redirect("/practice/login");

  const features = (user.tenant.features ?? {}) as {
    voice?: boolean;
    webForm?: boolean;
    webFormRequestedAt?: string;
  };

  return (
    <PracticeDashboard
      email={user.email}
      tenant={{
        slug: user.tenant.slug,
        name: user.tenant.name,
        status: user.tenant.status,
        features,
      }}
    />
  );
}
