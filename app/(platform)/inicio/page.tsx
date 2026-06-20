import type { Metadata } from "next";
import { HomeScreen } from "@/components/features/home/home-screen";
import { getPeliculas } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Inicio" };
export const revalidate = 60;

export default async function HomePage() {
  const items = await getPeliculas();
  return <HomeScreen items={items} />;
}
