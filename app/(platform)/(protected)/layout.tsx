import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";

interface ProtectedLayoutProps {
  readonly children: React.ReactNode;
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isGuest = cookies().get("gma_guest")?.value === "1";

  if (!user && !isGuest) {
    redirect("/");
  }

  return <>{children}</>;
}
