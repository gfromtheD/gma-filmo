import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileSelector } from "@/components/features/profiles/profile-selector";

export const metadata: Metadata = { title: "Perfiles" };

export default function PerfilesPage() {
  return (
    <Suspense>
      <ProfileSelector />
    </Suspense>
  );
}
