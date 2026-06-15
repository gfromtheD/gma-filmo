import type { Metadata } from "next";
import { Suspense } from "react";
import { StudioScreen } from "@/components/features/studio/studio-screen";

export const metadata: Metadata = { title: "Mi Estudio" };

export default function MiEstudioPage() {
  return (
    <Suspense>
      <StudioScreen />
    </Suspense>
  );
}
