import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/current";
import { Module1AtsConsole } from "@/components/Module1AtsConsole";

export default async function Module1Page() {
  const auth = await getCurrentAuth();
  if (!auth) {
    redirect("/?returnTo=/dashboard/module-1");
  }

  return <Module1AtsConsole />;
}
