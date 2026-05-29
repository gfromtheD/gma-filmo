"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useUserProfile } from "@/hooks/use-user-profile";
import {
  ICON_IDS, ICON_LABELS, COLOR_IDS, COLOR_VALUES,
  renderAvatar, type AvatarColor,
} from "@/lib/data/profile-avatars";

// ─── Predefined gallery images ────────────────────────────────────────────────

const GALLERY_IMAGES = Array.from({ length: 15 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  // Filename pattern from prepared_512 folder
  const fileMap: Record<string, string> = {
    "01": "profile_01_pin_1134203487428998775.jpg",
    "02": "profile_02_pin_1134203487428865505.jpg",
    "03": "profile_03_pin_1134203487428865604.jpg",
    "04": "profile_04_pin_1134203487428865533.jpg",
    "05": "profile_05_pin_1134203487428865514.jpg",
    "06": "profile_06_pin_1134203487428865634.jpg",
    "07": "profile_07_pin_1134203487428865703.jpg",
    "08": "profile_08_pin_1134203487428865756.jpg",
    "09": "profile_09_pin_1134203487428865562.jpg",
    "10": "profile_10_pin_1134203487428865692.jpg",
    "11": "profile_11_pin_1134203487428723813.jpg",
    "12": "profile_12_pin_1134203487428723775.jpg",
    "13": "profile_13_pin_1134203487428723962.jpg",
    "14": "profile_14_pin_1134203487428723780.jpg",
    "15": "profile_15_pin_1134203487428723748.jpg",
  };
  return { key: `gallery-${n}`, url: `/profiles/${fileMap[n]!}` };
});

// ─── Avatar preview ───────────────────────────────────────────────────────────

function AvatarPreview({
  name, color, iconId, imageUrl, size = 140,
}: {
  name:     string;
  color:    string;
  iconId:   string;
  imageUrl: string;
  size?:    number;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        style={{
          width: size, height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  if (iconId) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
        {renderAvatar(iconId, color, size)}
      </div>
    );
  }
  // Initial circle fallback
  const initial = (name[0] ?? "?").toUpperCase();
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.38, fontWeight: 800, color: "#03200F",
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label, description, learnMore, value, onChange,
}: {
  label:       string;
  description: string;
  learnMore?:  string;
  value:       boolean;
  onChange:    (v: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div className="flex w-full items-center gap-4 px-5 py-4">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-white">{label}</div>
          <div className="mt-0.5 text-[12px] text-[#3A4A5A]">{description}</div>
          {learnMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[11px] font-semibold text-[#22B16B]/70 transition-colors hover:text-[#22B16B]"
            >
              {expanded ? "Ocultar" : "Saber más"}
            </button>
          )}
          {expanded && learnMore && (
            <p className="mt-2 text-[12px] leading-[1.55] text-[#6D7D94]">{learnMore}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(!value)}
          className="shrink-0"
          aria-pressed={value}
        >
          <div
            className="relative h-6 w-11 rounded-full transition-colors duration-200"
            style={{ background: value ? "#22B16B" : "#1E1E1E" }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{ left: 2, transform: value ? "translateX(20px)" : "translateX(0)" }}
            />
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── PIN input ────────────────────────────────────────────────────────────────

function PinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  function handleChange(i: number, v: string) {
    const digit = v.replace(/\D/g, "").slice(-1);
    const arr = value.padEnd(4, " ").split("");
    arr[i] = digit || " ";
    const next = arr.join("").trimEnd();
    onChange(next);
    if (digit && i < 3) refs[i + 1]?.current?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !value[i] && i > 0) refs[i - 1]?.current?.focus();
  }

  return (
    <div className="flex gap-3 mt-3">
      {refs.map((ref, i) => (
        <input
          key={i}
          ref={ref}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-12 w-12 rounded-[10px] border border-[#2A2A2A] bg-[#0E1016] text-center text-[20px] font-bold text-white outline-none transition-colors focus:border-[#22B16B]/60"
        />
      ))}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export interface SubProfileValues {
  name:       string;
  color:      string;   // hex
  iconId:     string;
  imageUrl:   string;
  isKids:     boolean;
  requirePin: boolean;
  pin:        string;
  autoplay:   boolean;
}

interface ProfileEditModalProps {
  onClose:        () => void;
  title?:         string;
  initialValues?: Partial<SubProfileValues>;
  onSave?:        (values: SubProfileValues) => void;
  onDelete?:      () => void;
}

type Tab = "foto" | "icono" | "ajustes";

export function ProfileEditModal({ onClose, title, initialValues, onSave, onDelete }: ProfileEditModalProps) {
  const {
    displayName, avatarColor, avatarIconId, avatarImageUrl,
    isKids, requirePin, pin, autoplay,
    updateDisplayName, updateAvatarColor, updateSettings,
  } = useUserProfile();

  // Local state — seeded from initialValues (sub-profile) or context (Supabase profile)
  const [name,     setName]     = useState(initialValues?.name     ?? displayName);
  const [color,    setColor]    = useState(initialValues?.color    ?? avatarColor);
  const [iconId,   setIconId]   = useState(initialValues?.iconId   ?? avatarIconId);
  const [imageUrl, setImageUrl] = useState(initialValues?.imageUrl ?? avatarImageUrl);
  const [kids,   setKids]   = useState(initialValues?.isKids     ?? isKids);
  const [pinReq, setPinReq] = useState(initialValues?.requirePin ?? requirePin);
  const [pinVal, setPinVal] = useState(initialValues?.pin        ?? pin);
  const [tab,    setTab]    = useState<Tab>("foto");
  const [saving,   setSaving]   = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const tabRefs   = useRef<(HTMLButtonElement | null)[]>([]);
  const [tabPill, setTabPill] = useState({ left: 0, width: 0 });
  const [pillReady, setPillReady] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function selectGalleryImage(url: string) {
    setImageUrl(url);
    setIconId("");
  }

  function selectIcon(id: string) {
    setIconId(id);
    setImageUrl("");
  }

  function clearVisual() {
    setIconId("");
    setImageUrl("");
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setImageUrl(data);
      setIconId("");
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    const trimmed = name.trim();

    if (onSave) {
      // Sub-profile mode: hand data back to caller, no Supabase/localStorage writes
      onSave({
        name:       trimmed || displayName,
        color, iconId, imageUrl,
        isKids:     kids,
        requirePin: pinReq,
        pin:        pinReq ? pinVal : "",
        autoplay:   true,
      });
      setSaving(false);
      onClose();
      return;
    }

    // Supabase profile mode
    if (trimmed && trimmed !== displayName) await updateDisplayName(trimmed);
    if (color !== avatarColor) await updateAvatarColor(color);
    updateSettings({
      avatarIconId:   iconId,
      avatarImageUrl: imageUrl,
      isKids:         kids,
      requirePin:     pinReq,
      pin:            pinReq ? pinVal : "",
      autoplay:       autoplay,
    });
    setSaving(false);
    onClose();
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "foto",    label: "Foto" },
    { id: "icono",   label: "Icono" },
    { id: "ajustes", label: "Ajustes" },
  ];

  useLayoutEffect(() => {
    const idx = TABS.findIndex((t) => t.id === tab);
    const el  = tabRefs.current[idx];
    if (!el) return;
    setTabPill({ left: el.offsetLeft, width: el.offsetWidth });
    setPillReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center px-4 py-8"
      style={{ background: "rgba(5,8,16,0.82)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[780px] overflow-hidden rounded-[18px] border border-[#1E1E1E] shadow-2xl"
        style={{ background: "#0A0A0A", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left: live preview ─────────────────────────────────────── */}
        <div
          className="flex w-[260px] shrink-0 flex-col items-center justify-center gap-5 px-8 py-10 border-r border-[#141414]"
          style={{ background: "linear-gradient(160deg, #0D0D0D 0%, #080F0D 100%)" }}
        >
          <div
            style={{
              boxShadow: `0 0 0 3px ${color}, 0 0 40px ${color}55`,
              borderRadius: "50%",
            }}
          >
            <AvatarPreview name={name || "?"} color={color} iconId={iconId} imageUrl={imageUrl} size={130} />
          </div>
          <div className="text-center">
            <p className="text-[18px] font-extrabold tracking-[-0.01em] text-white">
              {name || displayName}
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#3A4A5A]"
               style={{ fontFamily: "ui-monospace, monospace" }}>
              ● previsualización
            </p>
          </div>

          {/* Color row */}
          <div>
            <p className="mb-2.5 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#3A4A5A]"
               style={{ fontFamily: "ui-monospace, monospace" }}>
              Color de acento
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {COLOR_IDS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(COLOR_VALUES[c as AvatarColor])}
                  className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: COLOR_VALUES[c as AvatarColor],
                    boxShadow: color === COLOR_VALUES[c as AvatarColor]
                      ? `0 0 0 2px #0A0A0A, 0 0 0 4px ${COLOR_VALUES[c as AvatarColor]}`
                      : "none",
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: form ────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#141414] px-6 py-4">
            <span className="text-[16px] font-extrabold text-white">{title ?? "Editar perfil"}</span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#5A6A7E] transition-colors hover:bg-[#1A1A1A] hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Name */}
            <div className="border-b border-[#0E0E0E] px-6 py-5">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-[#3A4A5A]"
                     style={{ fontFamily: "ui-monospace, monospace" }}>
                Nombre del perfil
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                className="w-full rounded-[10px] border border-[#1A1A1A] bg-[#0E1016] px-4 py-2.5 text-[15px] font-semibold text-white outline-none transition-colors focus:border-[#22B16B]/50"
                placeholder="¿Cómo te llamamos?"
              />
            </div>

            {/* Tab nav — pill style */}
            <div className="flex justify-center border-b border-[#0E0E0E] px-6 py-4">
              <nav
                className="relative flex gap-1 rounded-full border border-[#262626] p-1"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                {pillReady && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1 h-9 rounded-full border border-[#22B16B] backdrop-blur-sm transition-[left,width] duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{ left: tabPill.left, width: tabPill.width, background: "rgba(34,177,107,0.08)" }}
                  />
                )}
                {TABS.map((t, i) => (
                  <button
                    key={t.id}
                    ref={(el) => { tabRefs.current[i] = el; }}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className="relative z-10 flex h-9 items-center rounded-full px-6 text-[13.5px] font-semibold transition-colors duration-[260ms]"
                    style={{ color: tab === t.id ? "white" : "#4A5568" }}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* ── Tab: Foto ───────────────────────────────────────────── */}
            {tab === "foto" && (
              <div className="px-6 py-5 space-y-4">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

                {/* Gallery grid */}
                <div className="grid grid-cols-5 gap-2">
                  {GALLERY_IMAGES.map((img) => (
                    <button
                      key={img.key}
                      type="button"
                      onClick={() => selectGalleryImage(img.url)}
                      className="relative overflow-hidden rounded-[10px] transition-transform hover:scale-105"
                      style={{
                        aspectRatio: "1",
                        boxShadow: imageUrl === img.url
                          ? "0 0 0 2.5px #22B16B"
                          : "0 0 0 1px #1A1A1A",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                      {imageUrl === img.url && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="rounded-full bg-[#22B16B] p-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Actions — bottom right */}
                <div className="flex items-center justify-end gap-3">
                  {(imageUrl || iconId) && (
                    <button
                      type="button"
                      onClick={clearVisual}
                      className="text-[12px] text-[#5A6A7E] transition-colors hover:text-[#ff5252]"
                    >
                      Quitar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 rounded-full border border-[#2A2A2A] bg-[#111] px-4 py-2 text-[12.5px] font-semibold text-[#B8C5D4] transition-colors hover:border-[#22B16B]/50 hover:text-white"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Subir foto
                  </button>
                </div>
              </div>
            )}

            {/* ── Tab: Icono ──────────────────────────────────────────── */}
            {tab === "icono" && (
              <div className="px-6 py-5">
                <div className="grid grid-cols-5 gap-2">
                  {ICON_IDS.map((id) => {
                    const selected = id === iconId;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => selectIcon(id)}
                        aria-pressed={selected}
                        aria-label={ICON_LABELS[id]}
                        className="overflow-hidden rounded-[12px] transition-all duration-150"
                        style={{
                          aspectRatio: "1",
                          background: "#111",
                          boxShadow: selected
                            ? `0 0 0 2.5px ${color}`
                            : "0 0 0 1.5px #1A1A1A",
                          opacity:   selected ? 1 : 0.65,
                          transform: selected ? "scale(1.07)" : "scale(1)",
                        }}
                      >
                        {renderAvatar(id, color, undefined, true)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Tab: Ajustes ────────────────────────────────────────── */}
            {tab === "ajustes" && (
              <div className="mx-6 my-5 space-y-4">
                <div className="overflow-hidden rounded-[12px] border border-[#141414]">
                  <ToggleRow
                    label="Perfil para niños"
                    description="Solo contenido apto para +0/+7"
                    learnMore="Activa este modo para ocultar todo el contenido para adultos. Además, el perfil no podrá acceder a los ajustes de la cuenta ni modificar ninguna preferencia global de la plataforma."
                    value={kids}
                    onChange={setKids}
                  />
                  <div className="border-t border-[#141414]">
                    <ToggleRow
                      label="Pedir PIN al entrar"
                      description="Protege el acceso con un PIN de 4 dígitos"
                      value={pinReq}
                      onChange={setPinReq}
                    />
                    {pinReq && (
                      <div className="border-t border-[#141414] bg-[#0A0A0A] px-5 pb-4">
                        <p className="pt-3 text-[12px] text-[#5A6A7E]">PIN de acceso</p>
                        <PinInput value={pinVal} onChange={setPinVal} />
                        {pinVal.length < 4 && (
                          <p className="mt-2 text-[11px] text-[#F97316]">Introduce los 4 dígitos para guardar el PIN</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Danger zone */}
                {onDelete && (
                  <div className="overflow-hidden rounded-[12px] border border-[#2A1010]">
                    <button
                      type="button"
                      onClick={onDelete}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#1A0808]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-[#ff5252]">Eliminar perfil</div>
                        <div className="mt-0.5 text-[12px] text-[#3A4A5A]">Esta acción no se puede deshacer</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff5252" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-[#141414] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#1E1E1E] px-5 py-2.5 text-[13px] font-semibold text-[#6D7D94] transition-colors hover:border-[#2A2A2A] hover:text-white"
            >
              Cancelar
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || (pinReq && pinVal.length < 4)}
              className="rounded-full bg-[#22B16B] px-6 py-2.5 text-[13px] font-bold text-[#03200F] transition-colors hover:bg-[#2AC57A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
