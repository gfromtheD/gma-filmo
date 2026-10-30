"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { uploadAvatar, uploadBanner } from "@/lib/uploads/browser";
import { IMAGE_SNIFF_BYTES, imageContentProblem, sniffImageType, validateFile } from "@/lib/studio/file-rules";
import { readImageSize } from "@/lib/studio/image-size";
import { socialUrl } from "@/lib/social-links";
import { SocialLinksPanel, getSocialPlatform } from "@/components/ui/social-links-panel";
import { TextAreaField, TextField } from "./upload/fields";
import { ProfileHero, type ImageKind } from "./studio-profile-hero";
import type { StudioData } from "./studio-types";

// Deben coincidir con UPLOAD_CAPS en lib/r2/client.ts (ese módulo instancia el cliente S3 y no se importa en cliente).
const MAX_IMAGE_BYTES: Record<ImageKind, number> = { avatar: 5 * 1024 * 1024, banner: 10 * 1024 * 1024 };
const BIO_MAX = 280;
const IMAGE_NAME: Record<ImageKind, string> = { avatar: "La foto", banner: "El banner" };

const GLASS =
  "rounded-[22px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-7";

interface Props {
  data: StudioData;
  onToast: (msg: string, opts?: { error?: boolean }) => void;
}

type Form = { studioName: string; artistName: string; role: string; bio: string; location: string };

function Panel({ title, description, className = "", children }: { readonly title: string; readonly description: string; readonly className?: string; readonly children: ReactNode }) {
  return (
    <section className={`${GLASS} ${className}`}>
      <h2 className="text-[17px] font-semibold text-white">{title}</h2>
      <p className="mt-1 text-[13.5px] text-[#8A8A8A]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Pide al servidor que la página pública muestre ya el banner nuevo. Si falla, se verá al caducar su caché (1 h). */
async function refreshPublicPage() {
  const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
  if (!session) return;
  await fetch("/api/creator/refresh-public", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => undefined);
}

/** Antes de subir: peso, formato real (por el contenido) y medidas. Devuelve el motivo si no vale, o `null`. */
async function imageProblem(kind: ImageKind, file: File): Promise<string | null> {
  const basic = validateFile("image", file);
  if (basic) return basic;
  const maxBytes = MAX_IMAGE_BYTES[kind];
  if (file.size > maxBytes) return `${IMAGE_NAME[kind]} pesa más de ${maxBytes / 1024 / 1024} MB.`;
  const header = new Uint8Array(await file.slice(0, IMAGE_SNIFF_BYTES).arrayBuffer());
  return imageContentProblem(sniffImageType(header), await readImageSize(file));
}

/** Sube la imagen por el motor de subidas y devuelve su dirección, o el mensaje de error. */
async function uploadImage(kind: ImageKind, file: File): Promise<{ url?: string; error?: string }> {
  try {
    return { url: kind === "avatar" ? await uploadAvatar(file) : await uploadBanner(file) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo subir la imagen." };
  }
}

/**
 * Ficha de creador (no es el perfil de usuario de la plataforma): arriba la ficha tal como la verán los espectadores (donde se cambian banner y foto) y debajo los
 * datos, editables directamente. Al tocar algo aparece una barra para guardar o descartar.
 */
export function ProfileView({ data, onToast }: Props) {
  const reduceMotion = useReducedMotion();
  const c = data.creator;
  const initialForm: Form = { studioName: c.studioName, artistName: c.artistName, role: c.role, bio: c.bio, location: c.location };
  const [form, setForm] = useState<Form>(initialForm);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(c.socials);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [images, setImages] = useState<Record<ImageKind, string | null>>({ avatar: c.avatarUrl ?? null, banner: null });
  const [busyImage, setBusyImage] = useState<ImageKind | null>(null);

  // Sincroniza los datos recargados sin pisar una edición en curso.
  useEffect(() => {
    if (isDirty) return;
    setForm({ studioName: c.studioName, artistName: c.artistName, role: c.role, bio: c.bio, location: c.location });
    setSocialLinks(c.socials);
    setImages((prev) => ({ ...prev, avatar: c.avatarUrl ?? null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);

  // El banner se lee aparte: si su columna aún no existe en la base de datos, el resto de la ficha carga igual.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: row } = await supabase.from("creator_profiles").select("banner_url").eq("user_id", user.id).maybeSingle();
      if (!cancelled && row?.banner_url) setImages((prev) => ({ ...prev, banner: row.banner_url }));
    })();
    return () => { cancelled = true; };
  }, []);

  const set = (key: keyof Form, value: string) => { setForm((f) => ({ ...f, [key]: value })); setIsDirty(true); };
  const setSocial = (key: string, value: string) => { setSocialLinks((s) => ({ ...s, [key]: value })); setIsDirty(true); };

  async function saveImage(kind: ImageKind, url: string | null): Promise<boolean> {
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { onToast("Sesión caducada. Vuelve a iniciar sesión.", { error: true }); return false; }
    const patch = kind === "avatar" ? { avatar_url: url } : { banner_url: url };
    const { error } = await supabase.from("creator_profiles").update(patch).eq("user_id", user.id);
    if (error) { onToast(`${IMAGE_NAME[kind]} no se pudo guardar en la ficha.`, { error: true }); return false; }
    if (kind === "banner") void refreshPublicPage();
    return true;
  }

  async function handlePickImage(kind: ImageKind, file: File) {
    const problem = await imageProblem(kind, file);
    if (problem) { onToast(`${IMAGE_NAME[kind]} no se ha subido. ${problem}`, { error: true }); return; }
    setBusyImage(kind);
    const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
    if (!session) { setBusyImage(null); onToast("Sesión caducada. Vuelve a iniciar sesión.", { error: true }); return; }
    const { url, error } = await uploadImage(kind, file);
    if (error || !url) { setBusyImage(null); onToast(error ?? "No se pudo subir la imagen.", { error: true }); return; }
    const isSaved = await saveImage(kind, url);
    setBusyImage(null);
    if (!isSaved) return;
    setImages((prev) => ({ ...prev, [kind]: url }));
    onToast(kind === "avatar" ? "Foto actualizada" : "Banner actualizado");
  }

  async function handleRemoveImage(kind: ImageKind) {
    setBusyImage(kind);
    const isSaved = await saveImage(kind, null);
    setBusyImage(null);
    if (!isSaved) return;
    setImages((prev) => ({ ...prev, [kind]: null }));
    onToast(kind === "avatar" ? "Foto quitada" : "Banner quitado");
  }

  function handleDiscard() {
    setForm(initialForm);
    setSocialLinks(c.socials);
    setIsDirty(false);
  }

  async function handleSave() {
    if (!form.studioName.trim()) { onToast("El nombre del estudio no puede quedar vacío.", { error: true }); return; }
    if (form.bio.length > BIO_MAX) { onToast(`La biografía tiene más de ${BIO_MAX} caracteres.`, { error: true }); return; }
    const cleanSocialLinks: Record<string, string> = Object.fromEntries(Object.entries(socialLinks).map(([k, v]) => [k, v.trim()]).filter(([, v]) => !!v));
    const invalidSocial = Object.entries(cleanSocialLinks).find(([key, value]) => !socialUrl(key, value));
    if (invalidSocial) { onToast(`Revisa el enlace de ${getSocialPlatform(invalidSocial[0])?.label ?? invalidSocial[0]}.`, { error: true }); return; }

    setIsSaving(true);
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsSaving(false); onToast("No se pudo guardar: sesión no encontrada.", { error: true }); return; }
    const { error } = await supabase.from("creator_profiles").update({
      studio_name: form.studioName.trim(),
      creator_name: form.artistName.trim(),
      role: form.role.trim() || null,
      bio: form.bio.trim(),
      location: form.location.trim() || null,
      social_links: cleanSocialLinks,
    }).eq("user_id", user.id);
    setIsSaving(false);
    if (error) { onToast("Error al guardar la ficha.", { error: true }); return; }
    setIsDirty(false);
    onToast("Ficha actualizada");
  }

  const rise: Variants = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } };
  const publishedCount = data.titles.filter((t) => t.status === "publicado").length;

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : 0.07 } } }}
      className="mx-auto flex max-w-[1080px] flex-col gap-5 pb-28">
      <motion.header variants={rise}>
        <h1 className="text-[28px] font-semibold leading-tight text-white sm:text-[32px]">Tu ficha de creador</h1>
        <p className="mt-1.5 text-[15px] text-[#A8A8A8]">Así te verán los espectadores. Cambia el banner y la foto pasando el ratón por encima.</p>
      </motion.header>

      <motion.div variants={rise}>
        <ProfileHero
          studioName={form.studioName} artistName={form.artistName} role={form.role} location={form.location} bio={form.bio}
          socials={socialLinks} verified={c.verified} logoColors={c.logoColors} avatarUrl={images.avatar} bannerUrl={images.banner}
          publishedCount={publishedCount} avgRating={c.stats.avgRating} busy={busyImage}
          onPickImage={(kind, file) => void handlePickImage(kind, file)} onRemoveImage={(kind) => void handleRemoveImage(kind)}
        />
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div variants={rise}>
          <Panel title="Identidad" description="Cómo te presentas en tu ficha y en los créditos.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Nombre del estudio" value={form.studioName} onChange={(v) => set("studioName", v)} required />
              <TextField label="Nombre artístico" value={form.artistName} onChange={(v) => set("artistName", v)} />
              <TextField label="Rol o disciplina" value={form.role} onChange={(v) => set("role", v)} placeholder="Directora, animador…" />
              <TextField label="Ubicación" value={form.location} onChange={(v) => set("location", v)} placeholder="Ciudad, país" />
            </div>
          </Panel>
        </motion.div>
        <motion.div variants={rise}>
          <Panel title="Sobre ti" description="Unas líneas sobre tu trabajo: qué haces y qué te mueve.">
            <TextAreaField label="Biografía" value={form.bio} onChange={(v) => set("bio", v)} maxLength={BIO_MAX} rows={6} />
          </Panel>
        </motion.div>
        <motion.div variants={rise} className="lg:col-span-2">
          <Panel title="Redes sociales" description="Opcional. Aparecen bajo tu biografía para que el público te encuentre.">
            <SocialLinksPanel values={socialLinks} onChange={setSocial} accentColor="#2AC57A" />
          </Panel>
        </motion.div>
      </div>

      <AnimatePresence>
        {isDirty && (
          <motion.div role="region" aria-label="Cambios sin guardar"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+24px)] z-[41] mx-auto flex max-w-[560px] flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[22px] border border-white/10 bg-[#0C1611]/95 py-2.5 pl-4 pr-2.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:rounded-full sm:py-2 sm:pl-5 sm:pr-2 lg:bottom-6">
            <span className="text-[13.5px] font-semibold text-white">Tienes cambios sin guardar</span>
            <span className="flex gap-2">
              <button type="button" onClick={handleDiscard} disabled={isSaving}
                className="min-h-10 rounded-[4px] px-4 text-[13.5px] font-semibold text-[#C4C4C4] transition-colors hover:text-white disabled:opacity-50">Descartar</button>
              <button type="button" onClick={() => void handleSave()} disabled={isSaving}
                className="min-h-10 rounded-[4px] bg-[#22B16B] px-5 text-[13.5px] font-bold text-[#031A0E] shadow-[0_8px_24px_-8px_rgba(34,177,107,0.7)] transition-colors hover:bg-[#2AC57A] disabled:opacity-50">
                {isSaving ? "Guardando…" : "Guardar cambios"}
              </button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
