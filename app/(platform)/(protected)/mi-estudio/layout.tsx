import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function MiEstudioLayout({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/mi-espacio");
  }

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!creator) {
    redirect("/mi-espacio");
  }

  return <>{children}</>;
}
