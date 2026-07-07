"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Upload, ShieldCheck, Clapperboard, ArrowLeft } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ThreeDMarquee } from "@/components/ui/three-d-marquee";
import AnimatedGradientBackground from "@/components/ui/animated-gradient-background";
import { SocialLinksPanel, socialDisplayText } from "@/components/ui/social-links-panel";
import { useTransitionStore } from "@/store/use-transition-store";
import { useProfileStore } from "@/store/use-profile-store";
import { useUserProfile } from "@/hooks/use-user-profile";

const WIZARD_STEPS = ["Identidad", "Biografía", "Redes", "Acuerdos"] as const;

// Constantes de módulo: si estos arrays se recrearan en cada render, el efecto
// interno del halo se reiniciaría con cada pulsación de tecla (el fondo "salta")
const HALO_GRADIENT_COLORS = [
  "transparent",
  "transparent",
  "rgba(5,31,16,0.45)",
  "#0D4A28",
  "#1B8E56",
  "#29D480",
  "#22B16B",
  "#0F6B3A",
  "#073D20",
  "rgba(4,24,13,0.9)",
];
const HALO_GRADIENT_STOPS = [35, 48, 55, 61, 67, 72, 78, 85, 92, 100];

// Campos "editoriales": sin caja, solo línea base — para los datos protagonistas
const heroInputCls =
  "w-full border-0 border-b bg-transparent pb-2.5 text-white outline-none transition-colors border-white/15 placeholder-white/20 focus:border-[#3ED98B]";

const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/40";

export default function ConfigurarPerfilCreadorPage() {
  const router = useRouter();

  const [creatorName,   setCreatorName]   = useState("");
  const [studioName,    setStudioName]    = useState("");
  const [role,          setRole]          = useState("");
  const [location,      setLocation]      = useState("");
  const [bio,           setBio]           = useState("");
  const [socialLinks,   setSocialLinks]   = useState<Record<string, string>>({});
  const [acceptTerms,   setAcceptTerms]   = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [avatarUrl,         setAvatarUrl]         = useState("");
  // Object URL local: se pinta al instante al elegir el archivo, sin esperar a que termine de subirse
  const [avatarPreviewUrl,  setAvatarPreviewUrl]  = useState("");
  const [avatarUploading,   setAvatarUploading]   = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [init,          setInit]          = useState(true);
  const [error,         setError]         = useState("");
  // null = no decision yet (show conversion prompt), true = confirmed, false = declined
  const [conversionConfirmed, setConversionConfirmed] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [isExistingViewer,    setIsExistingViewer]    = useState(false);
  const [existingDisplayName, setExistingDisplayName] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const startExpand      = useTransitionStore((s) => s.startExpand);
  const setActiveProfile = useProfileStore((s) => s.setActiveProfile);
  const { refreshCreatorAvatar } = useUserProfile();

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setError("");

    // Preview inmediato: no depende de la subida ni de la red
    setAvatarPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setAvatarUploading(true);

    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Sesión caducada. Vuelve a iniciar sesión."); setAvatarUploading(false); return; }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("assetType", "avatar");

    try {
      const res = await fetch("/api/upload/file", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((body as { error?: string }).error ?? "No se pudo subir la imagen.");
        return;
      }
      setAvatarUrl((body as { publicUrl: string }).publicUrl);
    } catch {
      setError("Error de red al subir la imagen.");
    } finally {
      setAvatarUploading(false);
    }
  }

  // Libera el object URL local al desmontar la página
  useEffect(() => () => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl]);

  useEffect(() => {
    async function check() {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const { data: creatorRow } = await supabase
        .from("creator_profiles")
        .select("user_id, studio_name")
        .eq("user_id", user.id)
        .maybeSingle();

      // Already fully set up as creator → go to studio
      if (creatorRow?.studio_name) { router.replace("/mi-estudio"); return; }

      // Check if they already have a viewer profile (existing account)
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      // Any user with an existing profiles row is a viewer account
      const hasViewerAccount = !!profileRow?.display_name;
      setIsExistingViewer(hasViewerAccount && !creatorRow);
      if (hasViewerAccount) setExistingDisplayName(profileRow!.display_name);

      // If the user already confirmed conversion in this session (cookie persisted
      // across navigation), skip the confirmation screen and go straight to the form.
      const alreadyConfirmed = document.cookie.includes("gma_creator_setup=confirmed");
      if (alreadyConfirmed && hasViewerAccount && !creatorRow) {
        setConversionConfirmed(true);
      }

      const metaName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string;
      setCreatorName(metaName);
      setInit(false);
    }
    void check();
  }, [router]);

  const canSubmit =
    !!creatorName.trim() && !!studioName.trim() && acceptTerms && acceptPrivacy && !loading;

  async function handleSave(origin: { x: number; y: number }) {
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/"); return; }

    const cleanSocialLinks = Object.fromEntries(
      Object.entries(socialLinks)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => !!v)
    );

    const payload = {
      user_id:       user.id,
      creator_name:  creatorName.trim(),
      studio_name:   studioName.trim(),
      role:          role.trim()       || null,
      location:      location.trim()   || null,
      bio:           bio.trim().slice(0, 280) || null,
      avatar_url:    avatarUrl         || null,
      social_links:  cleanSocialLinks,
    };

    const { data: existing } = await supabase
      .from("creator_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error: err } = existing
      ? await supabase.from("creator_profiles").update(payload).eq("user_id", user.id)
      : await supabase.from("creator_profiles").insert(payload);

    if (err) {
      setError("Error al guardar. Inténtalo de nuevo.");
      setLoading(false);
    } else {
      document.cookie = "gma_creator_setup=; path=/; max-age=0; SameSite=Lax";
      setActiveProfile({ id: "__supabase__", name: creatorName.trim(), isKids: false });
      void refreshCreatorAvatar(); // que la píldora ya tenga la foto nueva al aterrizar

      // Misma animación de bienvenida que el selector de perfiles, pero disparada
      // directamente al aceptar — sin pasar por "¿Quién está viendo?", porque el
      // perfil que se acaba de crear ya se da por elegido. Nace del propio botón.
      const size = Math.hypot(window.innerWidth, window.innerHeight) * 2.6;
      startExpand(origin, size, creatorName.trim(), true, "creator");

      setTimeout(() => {
        router.push("/mi-estudio");
        router.refresh();
      }, 950);
    }
  }

  if (init) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#060C14" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22B16B] border-t-transparent" />
      </div>
    );
  }

  // Existing viewer: ask before showing the creator form
  if (isExistingViewer && conversionConfirmed === null) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4" style={{ background: "#060C14" }}>

        {/* Fondo — carrusel de portadas a pantalla completa: 4 columnas grandes.
            La extra extiende el grid a la derecha y cubre la esquina inferior. */}
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <ThreeDMarquee className="h-full w-full rounded-none" columns={3} extraColumns={1} />
        </div>
        {/* Oscurecido para legibilidad */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, rgba(6,12,20,0.5) 0%, rgba(6,12,20,0.72) 55%, rgba(6,12,20,0.94) 100%)" }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-52"
          style={{ background: "linear-gradient(to top, rgba(6,12,20,0.92), transparent)" }}
        />

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-[560px] rounded-[20px] p-8 md:p-10"
          style={{
            background: "rgba(10,18,32,0.74)",
            border: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(34,177,107,0.05)",
          }}
        >
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5A6A7E]">
            Ya tienes una cuenta en GMA Filmo
          </p>
          <h1 className="mt-3 text-center text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-white md:text-[30px]">
            ¿Añadir acceso de creador?
          </h1>
          <p className="mx-auto mt-2 max-w-[400px] text-center text-[13.5px] leading-[1.6] text-[#8A9AB0]">
            Tu cuenta seguirá siendo la misma: solo sumas las herramientas de creador.
          </p>

          {/* Cuenta detectada */}
          <div className="mt-6 flex items-center gap-3.5 rounded-[14px] border border-white/[0.07] bg-white/[0.04] p-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[17px] font-extrabold text-white"
              style={{ background: "linear-gradient(135deg,#22B16B,#14603A)" }}
            >
              {(existingDisplayName || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-white">{existingDisplayName || "usuario"}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5A6A7E]">Cuenta de espectador</p>
            </div>
            <span className="ml-auto shrink-0 rounded-full border border-[#22B16B]/25 bg-[#22B16B]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-[#22B16B]">
              Activa
            </span>
          </div>

          {/* Qué implica */}
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-4">
              <ShieldCheck size={18} className="text-[#22B16B]" />
              <p className="mt-2.5 text-[13px] font-bold text-white">Todo se conserva</p>
              <p className="mt-1 text-[12px] leading-[1.55] text-[#8A9AB0]">
                Tus valoraciones, listas e historial quedan intactos.
              </p>
            </div>
            <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-4">
              <Clapperboard size={18} className="text-[#22B16B]" />
              <p className="mt-2.5 text-[13px] font-bold text-white">Desbloqueas Mi Estudio</p>
              <p className="mt-1 text-[12px] leading-[1.55] text-[#8A9AB0]">
                Sube tus cortos y gestiona tu contenido desde tu cuenta.
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={async () => {
                document.cookie = "gma_creator_setup=; path=/; max-age=0; SameSite=Lax";
                await getSupabaseBrowserClient().auth.signOut();
                router.push("/");
              }}
              className="rounded-full border border-white/10 py-3 text-[13.5px] font-semibold text-[#B8C5D4] transition-colors hover:bg-white/[0.05] sm:w-[38%]"
            >
              No, cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                document.cookie = "gma_creator_setup=confirmed; path=/; max-age=600; SameSite=Lax";
                setConversionConfirmed(true);
              }}
              className="flex-1 rounded-full bg-[#22B16B] py-3 text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A]"
            >
              Sí, añadir acceso de creador
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Liquid glass en negro-verde: cristal oscuro translúcido de la misma familia
  // cromática que el fondo (nada de negros azulados), con brillo superior sutil
  const cardStyle = {
    background: "linear-gradient(160deg, rgba(7,29,18,0.72) 0%, rgba(3,15,9,0.62) 45%, rgba(5,22,13,0.68) 100%)",
    border: "1px solid rgba(120,220,170,0.14)",
    backdropFilter: "blur(22px) saturate(140%)",
    WebkitBackdropFilter: "blur(22px) saturate(140%)",
    boxShadow: "inset 0 1px 0 rgba(160,255,205,0.10), 0 24px 60px rgba(0,12,6,0.5)",
  };

  const canContinue = step === 0 ? !!creatorName.trim() && !!studioName.trim() : true;

  const socialChips = Object.entries(socialLinks)
    .filter(([, v]) => !!v.trim())
    .map(([key, v]) => socialDisplayText(key, v.trim()));

  return (
    <div
      className="relative flex min-h-screen flex-col justify-center overflow-hidden px-6 pt-8 pb-24"
      style={{
        // Rampa cromática de verdes: pino profundo arriba → esmeralda abajo
        background:
          "linear-gradient(180deg, #0D4029 0%, #0B3B25 16%, #0C482B 36%, #106038 56%, #158150 76%, #1DA55F 92%, #22B16B 100%)",
      }}
    >

      {/* Halo verde respirando — el mismo efecto del inicio pero centrado,
          dibujando un anillo completo alrededor de la card */}
      <AnimatedGradientBackground
        Breathing
        startingGap={80}
        breathingRange={6}
        animationSpeed={0.018}
        topOffset={0}
        gradientPosition="50% 50%"
        gradientColors={HALO_GRADIENT_COLORS}
        gradientStops={HALO_GRADIENT_STOPS}
        containerClassName="pointer-events-none"
      />

      {/* Volver — esquina superior izquierda. Retrocede de paso; en el primero, sale al inicio */}
      <button
        type="button"
        onClick={() => (step > 0 ? setStep((s) => s - 1) : router.push("/"))}
        className="absolute left-6 top-6 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[13px] font-semibold text-[#B8C5D4] transition-colors hover:bg-white/[0.07] hover:text-white"
      >
        <ArrowLeft size={15} />
        {step > 0 ? "Volver" : "Volver al inicio"}
      </button>

      <div className="relative z-10 mx-auto flex w-full max-w-[600px] flex-col">

        {/* Cabecera */}
        <div className="mb-7 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Configura tu estudio
          </p>
          <h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.02em] text-white">Completa tu perfil</h1>
          <p className="mt-2 text-[13px] text-white/50">Así te verá la comunidad de GMA Filmo.</p>
        </div>

        {/* Indicador de pasos */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {WIZARD_STEPS.map((label, i) => {
            const isDone = i < step;
            const isActive = i === step;
            return (
              <button
                key={label}
                type="button"
                disabled={i >= step}
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors ${
                  isActive ? "border border-[#3ED98B]/50 bg-white/[0.06]"
                  : isDone ? "border border-transparent hover:bg-white/[0.04]"
                  : "border border-transparent opacity-45"
                }`}
              >
                <span
                  className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold ${
                    isDone ? "bg-[#29D480] text-[#031A0E]"
                    : isActive ? "border border-[#3ED98B] text-[#3ED98B]"
                    : "border border-white/25 text-white/45"
                  }`}
                >
                  {isDone ? (
                    <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l2.5 2.5L9 1" stroke="#051910" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : i + 1}
                </span>
                <span className={`text-[12px] font-semibold ${isActive ? "text-white" : isDone ? "text-white/65" : "text-white/45"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-[#ff5252]/10 px-4 py-2.5 text-center text-[13px] text-[#ff5252]">
            {error}
          </div>
        )}

        {/* Card deslizante del paso actual */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 56 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -56 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="w-full rounded-[18px] p-7 md:p-8"
            style={cardStyle}
          >

            {/* Paso 1 — Identidad: composición editorial, el nombre como titular */}
            {step === 0 && (
              <div className="flex flex-col">
                <label className={labelCls}>Nombre artístico <span className="text-[#ff8a80]">*</span></label>
                <input
                  type="text" autoFocus value={creatorName} onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="Escribe tu nombre" maxLength={60} required
                  className={`${heroInputCls} text-[30px] font-extrabold tracking-[-0.02em] md:text-[34px]`}
                />

                <label className={`${labelCls} mt-7`}>Estudio o productora <span className="text-[#ff8a80]">*</span></label>
                <input
                  type="text" value={studioName} onChange={(e) => setStudioName(e.target.value)}
                  placeholder="El nombre de tu estudio" maxLength={80} required
                  className={`${heroInputCls} text-[19px] font-bold`}
                />

                <div className="mt-7 grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Rol / disciplina</label>
                    <input type="text" value={role} onChange={(e) => setRole(e.target.value)}
                      placeholder="Director · Guionista" maxLength={80}
                      className={`${heroInputCls} text-[14px] font-semibold`} />
                  </div>
                  <div>
                    <label className={labelCls}>Ubicación</label>
                    <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ciudad, país" maxLength={80}
                      className={`${heroInputCls} text-[14px] font-semibold`} />
                  </div>
                </div>

                <p className="mt-6 text-[11.5px] leading-[1.6] text-white/35">
                  Tu nombre y el de tu estudio encabezarán tu perfil público y firmarán cada corto que publiques.
                </p>
              </div>
            )}

            {/* Paso 2 — Biografía + foto: retrato a un lado, la voz al otro */}
            {step === 1 && (
              <div className="flex flex-col gap-6 sm:flex-row">
                <div className="flex shrink-0 flex-col items-center gap-3 sm:w-[150px] sm:pt-1">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => void handleAvatarFileChange(e)}
                  />
                  <div className="relative rounded-full p-[3px]" style={{ border: "1px dashed rgba(255,255,255,0.25)" }}>
                    {(avatarPreviewUrl || avatarUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarPreviewUrl || avatarUrl}
                        alt="Tu foto de perfil"
                        className="h-[88px] w-[88px] rounded-full object-cover"
                        style={{ opacity: avatarUploading ? 0.5 : 1 }}
                      />
                    ) : null}
                    {avatarUploading && (
                      <div className="absolute inset-0 grid place-items-center">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                      </div>
                    )}
                    {!avatarPreviewUrl && !avatarUrl && (
                      <div
                        className="flex h-[88px] w-[88px] items-center justify-center rounded-full text-[32px] font-extrabold text-white"
                        style={{ background: "linear-gradient(135deg,#22B16B,#14603A)" }}
                      >
                        {(studioName.trim() || creatorName.trim() || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={avatarUploading}
                    onClick={() => avatarInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11.5px] font-semibold text-white/80 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload size={11} /> {avatarUploading ? "Subiendo…" : avatarUrl ? "Cambiar foto" : "Subir foto"}
                  </button>
                  <p className="text-center text-[10.5px] leading-[1.5] text-white/35">
                    PNG, JPG o SVG.<br />Podrás cambiarla cuando quieras.
                  </p>
                </div>

                <div className="flex flex-1 flex-col">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <label className={`${labelCls} mb-0`}>Biografía</label>
                    <span className={`text-[11px] ${bio.length >= 260 ? "text-[#FFC24B]" : "text-white/35"}`}>{bio.length}/280</span>
                  </div>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={280}
                    autoFocus
                    placeholder="Cuéntale a la comunidad quién eres y qué tipo de cine haces…"
                    className="flex-1 w-full resize-none border-0 bg-transparent text-[16px] leading-[1.7] text-white placeholder-white/20 outline-none"
                    style={{ minHeight: 170 }}
                  />
                  <div className="mt-2 h-px w-full bg-white/10" />
                  <p className="mt-3 text-[11.5px] text-white/35">
                    Dos o tres frases bastan: qué haces, cómo lo haces y qué te mueve.
                  </p>
                </div>
              </div>
            )}

            {/* Paso 3 — Redes sociales: panel de logos, se expande el campo al pulsar uno */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <p className="text-[12.5px] leading-[1.6] text-white/60">
                  Elige dónde encontrarte y añade tu enlace. Todas son{" "}
                  <span className="font-semibold text-white">opcionales</span>.
                </p>
                <SocialLinksPanel
                  values={socialLinks}
                  onChange={(key, value) => setSocialLinks((s) => ({ ...s, [key]: value }))}
                  accentColor="#3ED98B"
                />
              </div>
            )}

            {/* Paso 4 — Vista previa + acuerdos */}
            {step === 3 && (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">
                    Así se verá tu perfil
                  </p>
                  <div className="rounded-[14px] border border-white/[0.12] bg-black/25 p-5">
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        {(avatarPreviewUrl || avatarUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarPreviewUrl || avatarUrl}
                            alt="Tu foto de perfil"
                            className="h-[56px] w-[56px] rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-[56px] w-[56px] items-center justify-center rounded-full text-[21px] font-extrabold text-white"
                            style={{ background: "linear-gradient(135deg,#22B16B,#1A7A4E)" }}
                          >
                            {(studioName.trim() || creatorName.trim() || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[17px] font-extrabold text-white">{creatorName.trim() || "Tu nombre"}</p>
                        <p className="truncate text-[12.5px] font-semibold text-[#3ED98B]">{studioName.trim() || "Tu estudio"}</p>
                        {(role.trim() || location.trim()) && (
                          <p className="mt-0.5 truncate text-[11.5px] text-white/45">
                            {[role.trim(), location.trim()].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    {bio.trim() && (
                      <p className="mt-3.5 text-[12.5px] leading-[1.6] text-white/60">{bio.trim()}</p>
                    )}
                    {socialChips.length > 0 && (
                      <div className="mt-3.5 flex flex-wrap gap-2">
                        {socialChips.map((chip) => (
                          <span key={chip} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/60">
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {[
                    {
                      checked: acceptTerms,
                      toggle: () => setAcceptTerms((v) => !v),
                      label: (
                        <>
                          He leído y acepto las{" "}
                          <a href="/terminos" className="font-semibold text-white underline-offset-2 hover:underline">
                            Condiciones de uso
                          </a>{" "}de GMA Filmo.
                        </>
                      ),
                    },
                    {
                      checked: acceptPrivacy,
                      toggle: () => setAcceptPrivacy((v) => !v),
                      label: (
                        <>
                          He leído y acepto la{" "}
                          <a href="/privacidad" className="font-semibold text-white underline-offset-2 hover:underline">
                            Política de privacidad
                          </a>.
                          {" "}Confirmo que el contenido que publique es de mi autoría o dispongo de los derechos necesarios.
                        </>
                      ),
                    },
                  ].map(({ checked, toggle, label }, i) => (
                    <label key={i} className="flex cursor-pointer items-start gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={toggle}
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          checked ? "border-[#29D480] bg-[#29D480]" : "border-white/30 bg-transparent"
                        }`}
                      >
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l2.5 2.5L9 1" stroke="#051910" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <span className="text-[13px] leading-[1.5] text-white/60">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Navegación del paso — atrás se gestiona con el botón Volver de arriba */}
            <div className="mt-7 flex items-center justify-end">
              {step < WIZARD_STEPS.length - 1 ? (
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => setStep((s) => s + 1)}
                  className="rounded-full bg-[#22B16B] px-7 py-2.5 text-[13.5px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Guardar y continuar →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    void handleSave({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                  }}
                  className="rounded-full bg-[#22B16B] px-7 py-2.5 text-[13.5px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Guardando…" : "Empezar a crear →"}
                </button>
              )}
            </div>

          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}
