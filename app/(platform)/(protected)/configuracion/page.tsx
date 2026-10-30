import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SettingsScreen } from "@/components/features/settings/settings-screen";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Configuración" };

/**
 * Configuración también es para invitados: lo que se guarda en el navegador (subtítulos, vistas previas) lo pueden
 * tocar; lo que pertenece a una cuenta sale con candado y, al pulsarlo, se les explica que necesitan iniciar sesión.
 * Se decide aquí, en el servidor, para que la pantalla no parpadee entre una versión y otra al cargar.
 */
export default async function SettingsPage() {
  const { data: { user } } = await getSupabaseServerClient().auth.getUser();
  const isGuest = !user && cookies().get("gma_guest")?.value === "1";
  return <SettingsScreen isGuest={isGuest} />;
}
