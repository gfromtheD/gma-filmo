import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  authorKey,
  resolveAuthor,
  type AccountProfile,
  type AuthorDisplay,
  type SubProfile,
} from "@/lib/profiles/author-avatar";

interface AuthorRef {
  readonly user_id: string;
  /** `""`/ausente = perfil principal de la cuenta. */
  readonly profile_id?: string | null;
}

/**
 * Resuelve cómo se muestra cada autor (nombre, foto o icono y color) con los datos ACTUALES de su
 * perfil: así, lo que se edita en el selector de perfiles se aplica a todo lo ya publicado.
 * Un perfil secundario solo cuenta si pertenece a esa misma cuenta; si no, se usa el principal.
 * Solo servidor (usa el cliente de administración).
 */
export async function loadAuthors(refs: readonly AuthorRef[]): Promise<Record<string, AuthorDisplay>> {
  const admin = getSupabaseAdminClient();
  const userIds = [...new Set(refs.map((ref) => ref.user_id))];
  const subIds = [...new Set(refs.map((ref) => ref.profile_id ?? "").filter((id) => id !== ""))];
  if (userIds.length === 0) return {};

  const [{ data: accounts }, { data: creators }, { data: subs }] = await Promise.all([
    admin.from("profiles").select("id, display_name, avatar_url, avatar_color, avatar_id").in("id", userIds),
    admin.from("creator_profiles").select("user_id, avatar_url").in("user_id", userIds),
    subIds.length > 0
      ? admin.from("sub_profiles").select("id, user_id, name, avatar_id, color").in("id", subIds)
      : Promise.resolve({ data: [] as { id: string; user_id: string; name: string; avatar_id: string; color: string }[] }),
  ]);

  const accountById = new Map<string, AccountProfile>(
    (accounts ?? []).map((account) => [
      account.id,
      {
        display_name: account.display_name,
        avatar_url: account.avatar_url,
        avatar_color: account.avatar_color,
        avatar_id: account.avatar_id,
      },
    ]),
  );
  const creatorPhotoById = new Map<string, string | null>((creators ?? []).map((creator) => [creator.user_id, creator.avatar_url]));
  const subById = new Map<string, SubProfile & { user_id: string }>((subs ?? []).map((sub) => [sub.id, sub]));

  const result: Record<string, AuthorDisplay> = {};
  for (const ref of refs) {
    const profileId = ref.profile_id ?? "";
    const key = authorKey(ref.user_id, profileId);
    if (key in result) continue;
    const sub = profileId !== "" ? subById.get(profileId) : undefined;
    const owned = sub && sub.user_id === ref.user_id ? sub : null;
    result[key] = resolveAuthor({
      userId: ref.user_id,
      profileId: owned ? profileId : "",
      account: accountById.get(ref.user_id) ?? null,
      sub: owned,
      creatorPhoto: creatorPhotoById.get(ref.user_id) ?? null,
    });
  }
  return result;
}
