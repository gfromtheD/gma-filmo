import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioScreen } from "@/components/features/studio/studio-screen";
import { getPeliculas } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Mi Estudio" };

export default async function MiEstudioPage() {
  const items = await getPeliculas();
  return (
    <Suspense>
      <StudioScreen items={items} />
    </Suspense>
  );
}
