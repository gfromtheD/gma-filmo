import type { Metadata } from "next";
import { HomeScreen } from "@/components/features/home/home-screen";
import { getPeliculas, getColecciones } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Inicio" };
export const revalidate = 60;

export default async function HomePage() {
  const [items, colecciones] = await Promise.all([getPeliculas(), getColecciones()]);
  return <HomeScreen items={items} colecciones={colecciones} />;
}
