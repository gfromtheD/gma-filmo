import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Entra como invitado: cierra cualquier sesión previa, limpia las cookies de alta de creador y deja la de invitado
 * (24 h). Lanza si algo falla, para que quien lo llama decida cómo avisarlo.
 */
export async function enterAsGuest(redirectPath: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient().auth.signOut();
  if (error) throw error;
  for (const name of ["gma_creator_pending", "gma_creator_setup"]) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  }
  document.cookie = "gma_guest=1; path=/; max-age=86400; SameSite=Lax";
  window.location.assign(redirectPath);
}
