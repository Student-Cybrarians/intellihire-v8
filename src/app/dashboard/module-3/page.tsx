import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/current";
import { Module3TechnicalInterview } from "@/components/Module3TechnicalInterview";

export default async function Module3Page() {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/?returnTo=/dashboard/module-3");
  return <Module3TechnicalInterview />;
}
