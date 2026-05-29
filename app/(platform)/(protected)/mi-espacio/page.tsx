import type { Metadata } from "next";
import { MySpaceScreen } from "@/components/features/space/my-space-screen";
import { GuestGate } from "@/components/ui/guest-gate";
import { getPeliculas } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Mi Espacio" };

export default async function MySpacePage() {
  const items = await getPeliculas();
  return (
    <GuestGate message="Tu espacio personal con watchlist, historial y valoraciones requiere una cuenta.">
      <MySpaceScreen items={items} />
    </GuestGate>
  );
}
