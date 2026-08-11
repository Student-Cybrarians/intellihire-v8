import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/current";
import { Module2Assessment } from "@/components/Module2Assessment";

export default async function Module2Page() {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/?returnTo=/dashboard/module-2");
  return <Module2Assessment />;
}
