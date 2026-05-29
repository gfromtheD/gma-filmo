import type { Metadata } from "next";
import { SearchScreen } from "@/components/features/search/search-screen";
import { getPeliculas } from "@/lib/supabase/queries";

export const metadata: Metadata = { title: "Buscador" };

export default async function SearchPage() {
  const items = await getPeliculas();
  return <SearchScreen items={items} />;
}
