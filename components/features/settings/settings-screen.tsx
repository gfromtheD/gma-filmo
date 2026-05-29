"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProfileStore } from "@/store/use-profile-store";
import { GmaIcon } from "@/components/ui/gma-icon";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useActiveProfileDisplay } from "@/hooks/use-active-profile-display";
import { useSettingsPrefs } from "@/hooks/use-settings-prefs";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { renderAvatar } from "@/lib/data/profile-avatars";
import type { GmaIconName } from "@/components/ui/gma-icon";

// ─── Tab registry ─────────────────────────────────────────────────────────────

type TabId =
  | "cuenta"
  | "idioma"
  | "reproduccion"
  | "parental"
  | "notificaciones"
  | "dispositivos";

interface Tab {
  readonly id: TabId;
  readonly label: string;
  readonly icon: GmaIconName;
}

const TABS: readonly Tab[] = [
  { id: "cuenta",         label: "Cuenta",                      icon: "user"      },
  { id: "idioma",         label: "Idioma y subtítulos",          icon: "languages" },
  { id: "reproduccion",   label: "Preferencias de reproducción", icon: "play"      },
  { id: "parental",       label: "Control parental",             icon: "shield"    },
  { id: "notificaciones", label: "Notificaciones",               icon: "bell"      },
  { id: "dispositivos",   label: "Dispositivos",                 icon: "download"  },
];

const serifItalic: React.CSSProperties = {
  fontFamily: "var(--font-serif), 'Instrument Serif', Georgia, serif",
  fontStyle: "italic",
};

function formatMemberSince(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const [active, setActive] = useState<TabId>("cuenta");
  const activeProfile = useProfileStore((s) => s.activeProfile);

  if (activeProfile?.isKids) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1A1A1A] text-[#5A6A7E]">
          <GmaIcon name="shield" size={28} />
        </div>
        <p className="text-[18px] font-bold text-white">Acceso restringido</p>
        <p className="max-w-[320px] text-[14px] leading-[1.6] text-[#5A6A7E]">
          Los perfiles para niños no pueden acceder a la configuración de la cuenta.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-8 pb-24 pt-10">
      <div className="mb-7">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6D7D94]">
          Configuración
        </p>
        <h1 className="text-[40px] leading-none text-white" style={serifItalic}>
          Ajustes y preferencias
        </h1>
      </div>

      <div className="mb-8 border-b border-[#262626]">
        <div className="flex overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors duration-150 ${
                  isActive
                    ? "border-[#22B16B] text-[#22B16B]"
                    : "border-transparent text-[#6D7D94] hover:text-white"
                }`}
              >
                <GmaIcon name={tab.icon} size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {active === "cuenta"         && <CuentaSection />}
      {active === "idioma"         && <IdiomaSection />}
      {active === "reproduccion"   && <ReproduccionSection />}
      {active === "parental"       && <ParentalSection />}
      {active === "notificaciones" && <NotificacionesSection />}
      {active === "dispositivos"   && <DispositivosSection />}
    </div>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────────

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function SettingsCard({
  title,
  description,
  children,
  span,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  span?: "full";
}) {
  return (
    <div className={`rounded-xl border border-[#1C1C1C] bg-[#0D0D0D] p-6 ${span === "full" ? "col-span-2" : ""}`}>
      <p className="text-[15.5px] font-bold text-white">{title}</p>
      {description && (
        <p className="mt-1 text-[12.5px] leading-[1.5] text-[#6D7D94]">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ─── Control primitives ───────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
        value ? "bg-[#22B16B]" : "bg-[#2A2A2A]"
      }`}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
        style={{ left: 2, transform: value ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13.5px] font-semibold text-white">{label}</span>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function GmaSelect({
  value,
  options,
  onChange,
  fullWidth,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  fullWidth?: boolean;
}) {
  return (
    <div className={`relative ${fullWidth ? "w-full" : ""}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-[8px] border border-[#2A2A2A] bg-[#1A1A1A] py-2.5 pl-4 pr-9 text-[13px] font-medium text-white outline-none focus:border-[#22B16B] ${
          fullWidth ? "w-full" : ""
        }`}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <GmaIcon
        name="chevronDown"
        size={13}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6D7D94]"
      />
    </div>
  );
}

function ActionButton({ label, danger, onClick, disabled }: {
  label: string;
  danger?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors duration-150 disabled:opacity-40 ${
        danger
          ? "bg-[#ff5252]/10 text-[#ff5252] hover:bg-[#ff5252]/20"
          : "bg-[#1A1A1A] text-[#B8C5D4] hover:bg-[#262626] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function Feedback({ text, danger }: { text: string; danger?: boolean }) {
  return (
    <p className={`mt-2 text-[12px] ${danger ? "text-[#ff5252]" : "text-[#22B16B]"}`}>{text}</p>
  );
}

// ─── Cuenta ───────────────────────────────────────────────────────────────────

function CuentaSection() {
  const router   = useRouter();
  const profile  = useUserProfile();
  const { displayName, avatarColor, avatarIconId, avatarImageUrl } = useActiveProfileDisplay();

  const [showEmailForm,    setShowEmailForm]    = useState(false);
  const [newEmail,         setNewEmail]         = useState("");
  const [emailFeedback,    setEmailFeedback]    = useState<{ text: string; danger?: boolean } | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<{ text: string; danger?: boolean } | null>(null);
  const [deleteConfirm,    setDeleteConfirm]    = useState(false);
  const [deleteInput,      setDeleteInput]      = useState("");
  const [deleting,         setDeleting]         = useState(false);
  const [deleteFeedback,   setDeleteFeedback]   = useState<{ text: string; danger?: boolean } | null>(null);
  const [signingOut,       setSigningOut]       = useState(false);

  const initial = (displayName?.[0] ?? "?").toUpperCase();

  async function handlePasswordReset() {
    if (!profile.email) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) {
      setPasswordFeedback({ text: "No se pudo enviar el enlace. Inténtalo de nuevo.", danger: true });
    } else {
      setPasswordFeedback({ text: `Hemos enviado un enlace a ${profile.email}. Revisa tu bandeja.` });
    }
  }

  async function handleEmailChange() {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    if (error) {
      setEmailFeedback({ text: "No se pudo cambiar el correo. Comprueba la dirección.", danger: true });
    } else {
      setEmailFeedback({ text: `Hemos enviado un enlace de confirmación a ${trimmed}. Revisa tu bandeja.` });
      setShowEmailForm(false);
      setNewEmail("");
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteFeedback(null);
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setDeleteFeedback({ text: "No se pudo autenticar. Recarga la página.", danger: true }); setDeleting(false); return; }
    const res = await fetch("/api/user/delete-data", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    if (!json.ok) {
      setDeleteFeedback({ text: json.error ?? "Error al eliminar la cuenta. Inténtalo de nuevo.", danger: true });
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleGlobalSignOut() {
    setSigningOut(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut({ scope: "global" });
    router.push("/login");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Profile header */}
      <div className="flex items-center gap-5 rounded-xl border border-[#1C1C1C] bg-[#0D0D0D] p-6">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px]">
          {avatarImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarImageUrl} alt="" className="h-full w-full object-cover" />
          ) : avatarIconId ? (
            renderAvatar(avatarIconId, avatarColor, 64) as React.ReactNode
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-[28px] font-extrabold text-[#03200F]"
              style={{ background: avatarColor ?? "#22B16B" }}
            >
              {initial}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[20px] font-extrabold text-white">{displayName}</div>
          {profile.memberSince && (
            <div className="mt-0.5 text-[13px] text-[#6D7D94]">
              Miembro desde {formatMemberSince(profile.memberSince)}
            </div>
          )}
        </div>
        <ActionButton label="Editar perfil" onClick={() => router.push("/perfiles?edit=true")} />
      </div>

      <CardGrid>
        {/* Email */}
        <SettingsCard title="Correo electrónico">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#6D7D94]">{profile.email ?? "—"}</span>
            <ActionButton
              label={showEmailForm ? "Cancelar" : "Cambiar"}
              onClick={() => { setShowEmailForm((v) => !v); setEmailFeedback(null); }}
            />
          </div>
          {showEmailForm && (
            <div className="mt-3 flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nuevo@correo.com"
                className="flex-1 rounded-[8px] border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-[13px] text-white placeholder-[#6D7D94] outline-none focus:border-[#22B16B]"
              />
              <ActionButton label="Confirmar" onClick={() => void handleEmailChange()} />
            </div>
          )}
          {emailFeedback && <Feedback text={emailFeedback.text} danger={emailFeedback.danger} />}
        </SettingsCard>

        {/* Password */}
        <SettingsCard title="Contraseña" description="Te enviaremos un enlace a tu correo para restablecerla.">
          <div className="flex justify-end">
            <ActionButton label="Cambiar" onClick={() => void handlePasswordReset()} />
          </div>
          {passwordFeedback && <Feedback text={passwordFeedback.text} danger={passwordFeedback.danger} />}
        </SettingsCard>

        {/* Plan — decorative until billing is wired */}
        <SettingsCard title="Plan actual" description="Gestión de planes disponible próximamente.">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-[#22B16B]/10 px-3 py-1 text-[12px] font-bold text-[#22B16B]">
              PRIME
            </span>
            <ActionButton label="Gestionar" disabled />
          </div>
        </SettingsCard>

        {/* Payment — decorative */}
        <SettingsCard title="Método de pago" description="Gestión de pagos disponible próximamente.">
          <div className="flex justify-end">
            <ActionButton label="Gestionar" disabled />
          </div>
        </SettingsCard>

        {/* Delete account */}
        <SettingsCard
          title="Eliminar cuenta"
          description="Borra permanentemente tu cuenta y todos tus datos. Esta acción no tiene vuelta atrás."
        >
          {!deleteConfirm ? (
            <div className="flex justify-end">
              <ActionButton
                label="Eliminar cuenta"
                danger
                onClick={() => { setDeleteConfirm(true); setDeleteInput(""); setDeleteFeedback(null); }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] leading-[1.5] text-[#ff5252]">
                Se eliminarán tu lista, historial, valoraciones, comentarios y tu cuenta de forma permanente. Escribe{" "}
                <span className="font-bold">eliminar cuenta</span> para confirmar.
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="eliminar cuenta"
                className="w-full rounded-[8px] border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-[13px] text-white placeholder-[#3A4A5E] outline-none focus:border-[#ff5252]"
              />
              <div className="flex justify-end gap-2">
                <ActionButton
                  label="Cancelar"
                  onClick={() => { setDeleteConfirm(false); setDeleteInput(""); setDeleteFeedback(null); }}
                  disabled={deleting}
                />
                <ActionButton
                  label={deleting ? "Eliminando…" : "Confirmar eliminación"}
                  danger
                  disabled={deleting || deleteInput.trim().toLowerCase() !== "eliminar cuenta"}
                  onClick={() => void handleDeleteAccount()}
                />
              </div>
            </div>
          )}
          {deleteFeedback && <Feedback text={deleteFeedback.text} danger={deleteFeedback.danger} />}
        </SettingsCard>

        {/* Global signout */}
        <SettingsCard
          title="Cerrar sesión en todos los dispositivos"
          description="Se cerrarán todas las sesiones activas."
        >
          <div className="flex justify-end">
            <ActionButton
              label={signingOut ? "Cerrando…" : "Cerrar sesiones"}
              danger
              disabled={signingOut}
              onClick={() => void handleGlobalSignOut()}
            />
          </div>
        </SettingsCard>
      </CardGrid>
    </div>
  );
}

// ─── Idioma y subtítulos ──────────────────────────────────────────────────────

function IdiomaSection() {
  const { prefs, set } = useSettingsPrefs();

  return (
    <div className="grid grid-cols-2 gap-4">
      <SettingsCard title="Idioma de la aplicación" description="Cambia el idioma de menús y descripciones.">
        <GmaSelect
          value={prefs.appLang}
          options={["Español (España)", "Español (Latino)", "English", "Português", "Français"]}
          onChange={(v) => set("appLang", v)}
          fullWidth
        />
      </SettingsCard>

      <SettingsCard title="Idioma preferido de audio" description="Se selecciona al iniciar una reproducción.">
        <GmaSelect
          value={prefs.audioLang}
          options={[
            "Español castellano · Original",
            "Español (Latino)",
            "English · Original",
            "Português",
            "Français",
          ]}
          onChange={(v) => set("audioLang", v)}
          fullWidth
        />
      </SettingsCard>

      <SettingsCard title="Subtítulos por defecto">
        <GmaSelect
          value={prefs.subsLang}
          options={["Español", "English", "Português", "Français", "Desactivado"]}
          onChange={(v) => set("subsLang", v)}
          fullWidth
        />
        <div className="mt-3 flex gap-2">
          <div className="flex flex-1 items-center justify-between rounded-[6px] border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6D7D94]">Tamaño</span>
            <span className="text-[12px] font-semibold text-white">Mediano</span>
          </div>
          <div className="flex flex-1 items-center justify-between rounded-[6px] border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6D7D94]">Fondo</span>
            <span className="text-[12px] font-semibold text-white">Sombra</span>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Audiodescripción" description="Pista descriptiva para personas con baja visión.">
        <ToggleRow
          label="Activar cuando esté disponible"
          value={prefs.audioDesc}
          onChange={(v) => set("audioDesc", v)}
        />
      </SettingsCard>

      <SettingsCard title="Subtítulos forzados" description="Para diálogos en otros idiomas dentro de la película.">
        <ToggleRow label="Activado" value={prefs.forcedSubs} onChange={(v) => set("forcedSubs", v)} />
      </SettingsCard>

      <SettingsCard title="Vista previa de subtítulos">
        <div className="flex min-h-[56px] items-center justify-center rounded-lg bg-[#1A1A1A] px-6 py-4">
          <span className="text-[15px] font-semibold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
            —¿Adónde van todos esos pájaros?
          </span>
        </div>
      </SettingsCard>
    </div>
  );
}

// ─── Preferencias de reproducción ────────────────────────────────────────────

function ReproduccionSection() {
  const { prefs, set } = useSettingsPrefs();

  return (
    <div className="grid grid-cols-2 gap-4">
      <SettingsCard title="Calidad de streaming" description="La calidad automática se adapta a tu conexión.">
        <GmaSelect
          value={prefs.calidad}
          options={["Auto", "Ultra HD (4K)", "Alta (1080p)", "Media (720p)", "Baja (480p)"]}
          onChange={(v) => set("calidad", v)}
          fullWidth
        />
      </SettingsCard>

      <SettingsCard title="Aviso de uso de datos" description="Notificar cuando se consuman más de 3 GB en datos móviles.">
        <ToggleRow label="Activar aviso" value={prefs.dataWarning} onChange={(v) => set("dataWarning", v)} />
      </SettingsCard>

      <SettingsCard title="Reproducir siguiente episodio" description="El siguiente episodio comienza automáticamente al terminar.">
        <ToggleRow label="Activado" value={prefs.autoNext} onChange={(v) => set("autoNext", v)} />
      </SettingsCard>

      <SettingsCard title="Reproducir vistas previas" description="Reproducir tráilers y avances al explorar el catálogo.">
        <ToggleRow label="Activado" value={prefs.autoPreviews} onChange={(v) => set("autoPreviews", v)} />
      </SettingsCard>

      <SettingsCard title="Saltar introducción" description="Omite la intro y los créditos iniciales automáticamente.">
        <ToggleRow label="Activado" value={prefs.skipIntro} onChange={(v) => set("skipIntro", v)} />
      </SettingsCard>
    </div>
  );
}

// ─── Control parental ─────────────────────────────────────────────────────────

function ParentalSection() {
  const { prefs, set } = useSettingsPrefs();

  return (
    <div className="grid grid-cols-2 gap-4">
      <SettingsCard title="PIN de acceso" description="Protege los perfiles con clasificación de edad avanzada.">
        <ToggleRow label="Requerir PIN" value={prefs.pinEnabled} onChange={(v) => set("pinEnabled", v)} />
      </SettingsCard>

      <SettingsCard title="Clasificación máxima" description="Restringe el catálogo visible según la clasificación de edad.">
        <GmaSelect
          value={prefs.maxRating}
          options={[
            "Todo el catálogo",
            "Hasta +18",
            "Hasta +16",
            "Hasta +13",
            "Solo para familias (+0/+7)",
          ]}
          onChange={(v) => set("maxRating", v)}
          fullWidth
        />
      </SettingsCard>
    </div>
  );
}

// ─── Notificaciones ───────────────────────────────────────────────────────────

function NotificacionesSection() {
  const { prefs, set } = useSettingsPrefs();

  return (
    <div className="grid grid-cols-2 gap-4">
      <SettingsCard title="Nuevos episodios" description="Aviso cuando se publiquen episodios de series que sigues.">
        <ToggleRow label="Activado" value={prefs.newEpisodes} onChange={(v) => set("newEpisodes", v)} />
      </SettingsCard>

      <SettingsCard title="Recordatorios de estrenos" description="Te avisamos antes de que estrene algo en tu lista.">
        <ToggleRow label="Activado" value={prefs.reminders} onChange={(v) => set("reminders", v)} />
      </SettingsCard>

      <SettingsCard title="Recomendaciones personalizadas" description="Basadas en tu historial de visualización.">
        <ToggleRow label="Activado" value={prefs.recommendations} onChange={(v) => set("recommendations", v)} />
      </SettingsCard>

      <SettingsCard title="Novedades por correo" description="Recibe noticias del catálogo en tu bandeja de entrada.">
        <ToggleRow label="Activado" value={prefs.newsletter} onChange={(v) => set("newsletter", v)} />
      </SettingsCard>

      <SettingsCard title="Notificaciones push" description="Avisos en tiempo real en tu dispositivo.">
        <ToggleRow label="Activado" value={prefs.pushNotifs} onChange={(v) => set("pushNotifs", v)} />
      </SettingsCard>
    </div>
  );
}

// ─── Dispositivos ─────────────────────────────────────────────────────────────

function DispositivosSection() {
  const router = useRouter();
  const { prefs, set } = useSettingsPrefs();
  const [showDevices, setShowDevices]   = useState(false);
  const [signingOut,  setSigningOut]    = useState(false);

  async function handleGlobalSignOut() {
    setSigningOut(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut({ scope: "global" });
    router.push("/login");
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <SettingsCard title="Sesiones activas" description="Dispositivos conectados a tu cuenta.">
        <div className="flex justify-end">
          <ActionButton
            label={showDevices ? "Ocultar" : "Ver dispositivos"}
            onClick={() => setShowDevices((v) => !v)}
          />
        </div>
        {showDevices && (
          <div className="mt-3 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-white">Este dispositivo</p>
                <p className="text-[11.5px] text-[#6D7D94]">Navegador web · Activo ahora</p>
              </div>
              <span className="rounded-full bg-[#22B16B]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#22B16B]">
                Activo
              </span>
            </div>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Calidad de descarga" description="Calidad para contenido descargado sin conexión.">
        <GmaSelect
          value={prefs.calidad}
          options={["Ultra HD (4K)", "Alta (1080p)", "Media (720p)", "Baja (480p)"]}
          onChange={(v) => set("calidad", v)}
          fullWidth
        />
      </SettingsCard>

      <SettingsCard
        title="Cerrar sesión en todos los dispositivos"
        description="Se cerrarán todas las sesiones activas en otros dispositivos."
      >
        <div className="flex justify-end">
          <ActionButton
            label={signingOut ? "Cerrando…" : "Cerrar sesiones"}
            danger
            disabled={signingOut}
            onClick={() => void handleGlobalSignOut()}
          />
        </div>
      </SettingsCard>
    </div>
  );
}
