import type { Metadata } from "next";
import { MyListScreen } from "@/components/features/space/my-list-screen";
import { GuestGate } from "@/components/ui/guest-gate";
import { getPeliculas } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Mi lista" };

export default async function MyListPage() {
  const items = await getPeliculas();
  return (
    <GuestGate message="Para guardar cortos y crear tus propias listas necesitas una cuenta.">
      <MyListScreen items={items} />
    </GuestGate>
  );
}
