"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { ProfileEditModal, type SubProfileValues } from "@/components/features/profiles/profile-edit-modal";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useActiveProfileDisplay } from "@/hooks/use-active-profile-display";
import { useSettingsPrefs, type SubtitleBackground, type SubtitleSize } from "@/hooks/use-settings-prefs";
import { useIsCreator } from "@/hooks/use-is-creator";
import { useProgress } from "@/hooks/use-progress";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { COLOR_VALUES, type AvatarColor } from "@/lib/data/profile-avatars";
import { useProfileStore } from "@/store/use-profile-store";
import { ChangePasswordForm } from "./password-fields";

type Feedback = { readonly text: string; readonly danger?: boolean } | null;

const GLASS =
  "rounded-[22px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl";
const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-white/[0.07] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/[0.13] focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40";
const DANGER_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[#ff5252]/12 px-4 text-[13.5px] font-semibold text-[#ff7b7b] transition-colors hover:bg-[#ff5252]/22 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40";

function formatMemberSince(date: Date | null): string {
  return date ? date.toLocaleDateString("es-ES", { month: "long", year: "numeric" }) : "";
}

/** Una fila del pliego de ajustes: qué es a la izquierda, el control a la derecha (apilado en móvil). */
function Row({ title, description, children }: { readonly title: string; readonly description: string; readonly children: ReactNode }) {
  return (
    <div className="grid gap-4 px-5 py-6 sm:px-7 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8">
      <div>
        <h3 className="text-[15.5px] font-semibold text-white">{title}</h3>
        <p className="mt-1 text-[13px] leading-5 text-[#8A8A8A]">{description}</p>
      </div>
      <div className="min-w-0 md:pt-0.5">{children}</div>
    </div>
  );
}

function FeedbackText({ feedback }: { readonly feedback: Feedback }) {
  return (
    <AnimatePresence>
      {feedback && (
        <motion.p role="status" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className={`mt-2 text-[12.5px] ${feedback.danger ? "text-[#ff7b7b]" : "text-[#5FD39A]"}`}>
          {feedback.text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function EmailRow({ email }: { readonly email: string | null }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = value.trim();
    if (!next) return;
    const { error } = await getSupabaseBrowserClient().auth.updateUser({ email: next });
    if (error) { setFeedback({ text: "No se pudo cambiar el correo. Comprueba la dirección.", danger: true }); return; }
    setFeedback({ text: `Te hemos enviado un enlace a ${next}. El cambio se aplica al abrirlo.` });
    setIsEditing(false);
    setValue("");
  }

  return (
    <Row title="Correo electrónico" description="Con el que entras en GMA Filmo y recibes los avisos de tu cuenta.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 break-all text-[14.5px] text-[#D0D0D0]">{email ?? "—"}</span>
        <button type="button" onClick={() => { setIsEditing((v) => !v); setFeedback(null); }} className={BUTTON}>
          {isEditing ? "Cancelar" : "Cambiar"}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {isEditing && (
          <motion.form onSubmit={(e) => void handleSubmit(e)} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="email" autoFocus required value={value} onChange={(e) => setValue(e.target.value)} placeholder="nuevo@correo.com" aria-label="Nuevo correo"
              className="min-w-0 flex-1 rounded-[10px] border border-white/15 bg-black/40 px-3.5 py-2.5 text-base text-white placeholder-[#7C7C7C] outline-none focus:border-[#22B16B] sm:text-[14px]" />
            <button type="submit" className="min-h-11 rounded-full bg-[#22B16B] px-5 text-[13.5px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A]">
              Enviar enlace
            </button>
          </motion.form>
        )}
      </AnimatePresence>
      <FeedbackText feedback={feedback} />
    </Row>
  );
}

function SessionsRow() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOutEverywhere() {
    setIsSigningOut(true);
    await getSupabaseBrowserClient().auth.signOut({ scope: "global" });
    router.push("/");
    router.refresh();
  }

  return (
    <Row title="Sesiones" description="Si has entrado en un dispositivo que ya no usas, cierra la sesión en todos a la vez.">
      <button type="button" disabled={isSigningOut} onClick={() => void handleSignOutEverywhere()} className={BUTTON}>
        {isSigningOut ? "Cerrando…" : "Cerrar sesión en todos los dispositivos"}
      </button>
    </Row>
  );
}

function DeleteAccountCard() {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [input, setInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const canDelete = input.trim().toLowerCase() === "eliminar cuenta";

  async function handleDelete() {
    setIsDeleting(true);
    setFeedback(null);
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setFeedback({ text: "No se pudo comprobar tu sesión. Recarga la página.", danger: true }); setIsDeleting(false); return; }
    const res = await fetch("/api/user/delete-data", { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
    const json = (await res.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string };
    if (!json.ok) {
      setFeedback({ text: json.error ?? "No se pudo eliminar la cuenta. Inténtalo de nuevo.", danger: true });
      setIsDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <section aria-labelledby="eliminar-cuenta" className="rounded-[22px] border border-[#ff5252]/20 bg-[#ff5252]/[0.04] px-5 py-6 sm:px-7">
      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8">
        <div>
          <h2 id="eliminar-cuenta" className="text-[15.5px] font-semibold text-white">Eliminar cuenta</h2>
          <p className="mt-1 text-[13px] leading-5 text-[#8A8A8A]">Borra tu cuenta y todos tus datos para siempre.</p>
        </div>
        <div className="min-w-0">
          {!isConfirming ? (
            <button type="button" onClick={() => { setIsConfirming(true); setInput(""); setFeedback(null); }} className={DANGER_BUTTON}>Eliminar mi cuenta</button>
          ) : (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
              <p className="text-[13.5px] leading-5 text-[#ffb3b3]">
                Se borrarán tus listas, tu historial, tus valoraciones, tus comentarios y tu cuenta. No se puede deshacer.
                Escribe <strong className="font-bold text-white">eliminar cuenta</strong> para confirmar.
              </p>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="eliminar cuenta" aria-label="Escribe eliminar cuenta para confirmar"
                className="w-full rounded-[10px] border border-white/15 bg-black/40 px-3.5 py-2.5 text-base text-white placeholder-[#5A5A5A] outline-none focus:border-[#ff5252] sm:text-[14px]" />
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" disabled={isDeleting} onClick={() => { setIsConfirming(false); setInput(""); setFeedback(null); }}
                  className="min-h-11 rounded-full px-4 text-[13.5px] font-semibold text-[#C4C4C4] hover:text-white disabled:opacity-40">Cancelar</button>
                <button type="button" disabled={isDeleting || !canDelete} onClick={() => void handleDelete()}
                  className="min-h-11 rounded-full bg-[#ff5252] px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-[#ff6b6b] disabled:opacity-40">
                  {isDeleting ? "Eliminando…" : "Eliminar para siempre"}
                </button>
              </div>
            </motion.div>
          )}
          <FeedbackText feedback={feedback} />
        </div>
      </div>
    </section>
  );
}

const SUBTITLE_SIZES: readonly { id: SubtitleSize; label: string }[] = [{ id: "s", label: "Pequeño" }, { id: "m", label: "Mediano" }, { id: "l", label: "Grande" }];
const SUBTITLE_BACKGROUNDS: readonly { id: SubtitleBackground; label: string }[] = [{ id: "shadow", label: "Sombra" }, { id: "box", label: "Caja" }, { id: "none", label: "Nada" }];
const PREVIEW_SIZE: Record<SubtitleSize, string> = { s: "text-[13px]", m: "text-[16px]", l: "text-[21px]" };
const PREVIEW_BACKGROUND: Record<SubtitleBackground, string> = {
  shadow: "[text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_6px_rgba(0,0,0,0.8)]",
  box: "bg-black/80 px-2 py-0.5",
  none: "",
};

function SubtitlesRow() {
  const { prefs, set } = useSettingsPrefs();
  return (
    <Row title="Subtítulos" description="Cómo se ven y si salen puestos al empezar una obra que los tenga. Siempre puedes cambiarlo desde el reproductor.">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[14px] text-[#D0D0D0]">Ponerlos al empezar</span>
        <Switch label="Poner los subtítulos al empezar" checked={prefs.subtitlesOn} onChange={(v) => set("subtitlesOn", v)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[#8A8A8A]">Tamaño</span>
          <Segmented label="Tamaño de los subtítulos" value={prefs.subtitleSize} options={SUBTITLE_SIZES} onChange={(v) => set("subtitleSize", v)} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[#8A8A8A]">Fondo</span>
          <Segmented label="Fondo de los subtítulos" value={prefs.subtitleBackground} options={SUBTITLE_BACKGROUNDS} onChange={(v) => set("subtitleBackground", v)} />
        </div>
      </div>
      <div aria-hidden="true" className="relative mt-4 flex aspect-[21/7] items-end justify-center overflow-hidden rounded-[14px] bg-[radial-gradient(120%_120%_at_30%_10%,#3d5a4a_0%,#16231c_45%,#070b09_100%)] p-4">
        <span className={`rounded-[3px] text-center font-semibold leading-snug text-white transition-all duration-200 ${PREVIEW_SIZE[prefs.subtitleSize]} ${PREVIEW_BACKGROUND[prefs.subtitleBackground]}`}>
          —¿Adónde van todos esos pájaros?
        </span>
      </div>
    </Row>
  );
}

function HistoryRow() {
  const { prefs, set } = useSettingsPrefs();
  const { clearHistory } = useProgress();
  const [isConfirming, setIsConfirming] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleClear() {
    const isCleared = await clearHistory();
    setIsConfirming(false);
    setFeedback(isCleared
      ? { text: "Historial borrado. «Seguir viendo» empieza de cero." }
      : { text: "No se pudo borrar el historial. Inténtalo de nuevo.", danger: true });
  }

  return (
    <Row title="Historial" description="Lo que ves se guarda para que puedas seguir donde lo dejaste. Es de este perfil.">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[14px] text-[#D0D0D0]">{prefs.pauseHistory ? "En pausa en este navegador" : "Guardando lo que ves"}</span>
        <Switch label="Pausar el historial" checked={prefs.pauseHistory} onChange={(v) => set("pauseHistory", v)} />
      </div>
      <p className="mt-1 text-[12.5px] text-[#7C7C7C]">Con el historial en pausa no se apunta nada nuevo, ni en «Seguir viendo».</p>
      <div className="mt-3">
        {!isConfirming ? (
          <button type="button" onClick={() => { setIsConfirming(true); setFeedback(null); }} className={BUTTON}>Borrar historial</button>
        ) : (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2 text-[13.5px] text-[#D0D0D0]">
            ¿Borrar todo lo visto de este perfil?
            <button type="button" onClick={() => setIsConfirming(false)} className="min-h-10 rounded-full px-3 font-semibold text-[#A8A8A8] hover:text-white">No</button>
            <button type="button" onClick={() => void handleClear()} className="min-h-10 rounded-full bg-white px-4 font-bold text-[#06170E] hover:bg-white/90">Borrar</button>
          </motion.div>
        )}
        <FeedbackText feedback={feedback} />
      </div>
    </Row>
  );
}

type ExportFormat = "html" | "json";
const EXPORT_FORMATS: readonly { id: ExportFormat; title: string; explanation: string }[] = [
  { id: "html", title: "Para leer", explanation: "Una página que se abre con doble clic en el navegador. La más sencilla si solo quieres ver tus datos." },
  { id: "json", title: "JSON", explanation: "Un archivo técnico para llevar tus datos a otro programa o servicio. Si no sabes qué es, elige «Para leer»." },
];

function DataExportRow() {
  const [isChoosing, setIsChoosing] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleExport(format: ExportFormat) {
    setExporting(format);
    setFeedback(null);
    try {
      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (!session) throw new Error("no session");
      const res = await fetch(`/api/user/export?format=${format}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `gma-filmo-mis-datos-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      setFeedback({ text: format === "html" ? "Descargado. Ábrelo con doble clic y se ve en el navegador." : "Descargado." });
      setIsChoosing(false);
    } catch {
      setFeedback({ text: "No se pudo preparar la descarga. Inténtalo de nuevo en un momento.", danger: true });
    } finally {
      setExporting(null);
    }
  }

  return (
    <Row title="Tus datos" description="Una copia de todo lo que guardamos de ti: perfil, listas, valoraciones, comentarios e historial.">
      {!isChoosing && (
        <button type="button" onClick={() => { setIsChoosing(true); setFeedback(null); }} className={BUTTON}>Descargar</button>
      )}
      <AnimatePresence initial={false}>
        {isChoosing && (
          <motion.div role="group" aria-label="Elige el formato de la descarga"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <p className="text-[13.5px] font-semibold text-white">¿En qué formato lo quieres?</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {EXPORT_FORMATS.map((option) => (
                <button key={option.id} type="button" disabled={exporting !== null} onClick={() => void handleExport(option.id)}
                  className="rounded-[14px] border border-white/10 bg-white/[0.04] p-3.5 text-left transition-colors hover:border-[#22B16B]/60 hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50">
                  <span className="block text-[14.5px] font-semibold text-white">{exporting === option.id ? "Preparando…" : option.title}</span>
                  <span className="mt-1 block text-[12.5px] leading-5 text-[#8A8A8A]">{option.explanation}</span>
                </button>
              ))}
            </div>
            <button type="button" disabled={exporting !== null} onClick={() => setIsChoosing(false)}
              className="mt-2 min-h-10 rounded-full px-3 text-[13px] font-semibold text-[#A8A8A8] hover:text-white disabled:opacity-50">Cancelar</button>
          </motion.div>
        )}
      </AnimatePresence>
      <FeedbackText feedback={feedback} />
    </Row>
  );
}

/** Solo creadores: avisos cuando valoran sus obras. Se guarda en su ficha, así vale en todos sus dispositivos. */
function CreatorNotificationsRow() {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from("creator_profiles").select("notify_ratings").eq("user_id", user.id).maybeSingle();
      if (!cancelled && !error && data) setIsEnabled(data.notify_ratings);
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleChange(next: boolean) {
    setIsEnabled(next);
    setFeedback(null);
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = user
      ? await supabase.from("creator_profiles").update({ notify_ratings: next }).eq("user_id", user.id)
      : { error: true };
    if (error) { setIsEnabled(!next); setFeedback({ text: "No se pudo guardar. Inténtalo de nuevo.", danger: true }); }
  }

  if (isEnabled === null) return null; // cargando, o la preferencia aún no existe en la base de datos
  return (
    <Row title="Notificaciones" description="Te avisamos en el menú de tu cuenta cuando alguien valora una de tus obras.">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[14px] text-[#D0D0D0]">{isEnabled ? "Avisarme de las valoraciones" : "Sin avisos de valoraciones"}</span>
        <Switch label="Avisarme cuando valoren mis obras" checked={isEnabled} onChange={(v) => void handleChange(v)} />
      </div>
      <FeedbackText feedback={feedback} />
    </Row>
  );
}

function SectionTitle({ children }: { readonly children: ReactNode }) {
  return <h2 className="mt-3 px-1 text-[13.5px] font-semibold text-[#8A8A8A]">{children}</h2>;
}

/** Cabecera con el perfil activo: editarlo aquí mismo o cambiar a otro perfil. */
function ProfileCard() {
  const profile = useUserProfile();
  const { displayName, avatarColor, avatarIconId, avatarImageUrl, isSubProfile } = useActiveProfileDisplay();
  const activeProfile = useProfileStore((s) => s.activeProfile);
  const profiles = useProfileStore((s) => s.profiles);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const subProfile = isSubProfile ? (profiles.find((p) => p.id === activeProfile?.id) ?? null) : null;
  const [isEditing, setIsEditing] = useState(false);

  function handleSaveSub(values: SubProfileValues) {
    if (!subProfile) return;
    const color = (Object.keys(COLOR_VALUES) as AvatarColor[]).find((k) => COLOR_VALUES[k] === values.color) ?? "green";
    updateProfile(subProfile.id, { name: values.name, avatarId: values.imageUrl || values.iconId || "estrella", color });
    setIsEditing(false);
  }

  return (
    <>
      {isEditing && (subProfile ? (
        <ProfileEditModal title="Editar perfil" onSave={handleSaveSub} onClose={() => setIsEditing(false)}
          initialValues={{ name: subProfile.name, color: avatarColor, iconId: avatarIconId, imageUrl: avatarImageUrl }} />
      ) : <ProfileEditModal onClose={() => setIsEditing(false)} />)}
      <section aria-label="Tu perfil" className={`${GLASS} relative overflow-clip p-5 sm:p-7`}>
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 size-64 rounded-full opacity-40 blur-3xl" style={{ background: avatarColor }} />
        <div className="relative flex flex-wrap items-center gap-5">
          <div className="size-[72px] shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
            <ProfileAvatar name={displayName} color={avatarColor} url={avatarImageUrl || null} iconId={avatarIconId || null} size="fill" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words text-[22px] font-semibold leading-tight text-white">{displayName}</p>
            <p className="mt-1 text-[13.5px] text-[#8A8A8A]">
              {isSubProfile ? "Perfil de tu cuenta" : profile.memberSince ? `En GMA Filmo desde ${formatMemberSince(profile.memberSince)}` : "Perfil principal"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setIsEditing(true)} className={BUTTON}>Editar perfil</button>
            <Link href="/perfiles" className={BUTTON}>Cambiar de perfil</Link>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Configuración: solo lo que de verdad funciona. El perfil activo; la cuenta (correo, contraseña y, para creadores,
 * avisos de valoraciones); la reproducción (subtítulos y vistas previas); privacidad (historial, descarga de datos y
 * sesiones) y, aparte, eliminar la cuenta.
 */
export function SettingsScreen() {
  const reduceMotion = useReducedMotion();
  const profile = useUserProfile();
  const { prefs, set } = useSettingsPrefs();
  const { isCreator } = useIsCreator();

  const rise: Variants = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } };

  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : 0.07 } } }}
      className="mx-auto flex max-w-[900px] flex-col gap-5 px-4 pb-24 pt-10 sm:px-6">
      <motion.header variants={rise} className="mb-2">
        <h1 className="text-[30px] font-semibold leading-tight text-white sm:text-[36px]">Configuración</h1>
        <p className="mt-1.5 text-[15px] text-[#A8A8A8]">Tu perfil, tu cuenta y cómo se comporta GMA Filmo contigo.</p>
      </motion.header>

      <motion.div variants={rise}><ProfileCard /></motion.div>

      <motion.div variants={rise}><SectionTitle>Cuenta</SectionTitle></motion.div>
      <motion.section variants={rise} aria-label="Cuenta" className={`${GLASS} divide-y divide-white/[0.06]`}>
        <EmailRow email={profile.email ?? null} />
        <Row title="Contraseña" description="Cámbiala aquí mismo, sin esperar ningún correo.">
          <ChangePasswordForm email={profile.email ?? null} />
        </Row>
        {isCreator && <CreatorNotificationsRow />}
      </motion.section>

      <motion.div variants={rise}><SectionTitle>Reproducción</SectionTitle></motion.div>
      <motion.section variants={rise} aria-label="Reproducción" className={`${GLASS} divide-y divide-white/[0.06]`}>
        <SubtitlesRow />
        <Row title="Vistas previas" description="Reproduce el tráiler de la portada al cabo de unos segundos. Nunca se activa si tu dispositivo pide reducir el movimiento o ahorrar datos.">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[14px] text-[#D0D0D0]">{prefs.autoPreviews ? "Activadas" : "Desactivadas"}</span>
            <Switch label="Reproducir vistas previas" checked={prefs.autoPreviews} onChange={(v) => set("autoPreviews", v)} />
          </div>
        </Row>
      </motion.section>

      <motion.div variants={rise}><SectionTitle>Privacidad y seguridad</SectionTitle></motion.div>
      <motion.section variants={rise} aria-label="Privacidad y seguridad" className={`${GLASS} divide-y divide-white/[0.06]`}>
        <HistoryRow />
        <DataExportRow />
        <SessionsRow />
      </motion.section>

      <motion.div variants={rise}><DeleteAccountCard /></motion.div>
    </motion.div>
  );
}
