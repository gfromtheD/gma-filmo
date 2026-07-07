"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Globe } from "lucide-react";
import { siInstagram, siTiktok, siYoutube, siX, siFacebook, siThreads, siVimeo } from "simple-icons";

export interface SocialPlatform {
  key: string;
  label: string;
  prefix: string;
  placeholder: string;
  path?: string;
  hex?: string;
  handleStyle?: boolean; // true → se muestra con "@" delante
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: "instagram", label: "Instagram", prefix: "instagram.com/", placeholder: "usuario", path: siInstagram.path, hex: `#${siInstagram.hex}`, handleStyle: true },
  { key: "tiktok",    label: "TikTok",    prefix: "tiktok.com/@",    placeholder: "usuario", path: siTiktok.path,    hex: `#${siTiktok.hex}`,    handleStyle: true },
  { key: "youtube",   label: "YouTube",   prefix: "youtube.com/@",   placeholder: "canal",   path: siYoutube.path,   hex: `#${siYoutube.hex}`,   handleStyle: true },
  { key: "x",         label: "X",         prefix: "x.com/",          placeholder: "usuario", path: siX.path,         hex: `#${siX.hex}`,         handleStyle: true },
  { key: "threads",   label: "Threads",   prefix: "threads.net/@",   placeholder: "usuario", path: siThreads.path,   hex: `#${siThreads.hex}`,   handleStyle: true },
  { key: "facebook",  label: "Facebook",  prefix: "facebook.com/",   placeholder: "página",  path: siFacebook.path,  hex: `#${siFacebook.hex}` },
  { key: "vimeo",     label: "Vimeo",     prefix: "vimeo.com/",      placeholder: "estudio", path: siVimeo.path,     hex: `#${siVimeo.hex}` },
  { key: "website",   label: "Web",       prefix: "https://",        placeholder: "tu-web.com" },
];

export function getSocialPlatform(key: string): SocialPlatform | undefined {
  return SOCIAL_PLATFORMS.find((p) => p.key === key);
}

// Texto corto para mostrar en chips/preview: "@usuario" para redes de handle, valor tal cual para el resto
export function socialDisplayText(key: string, value: string): string {
  const platform = getSocialPlatform(key);
  if (!platform) return value;
  return platform.handleStyle ? `@${value}` : value;
}

export function SocialPlatformIcon({ platform, size = 18 }: { platform: SocialPlatform; size?: number }) {
  if (!platform.path) return <Globe size={size} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={platform.path} />
    </svg>
  );
}

interface SocialLinksPanelProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  accentColor?: string;
}

export function SocialLinksPanel({ values, onChange, accentColor = "#3ED98B" }: SocialLinksPanelProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = activeKey ? getSocialPlatform(activeKey) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-center gap-2.5">
        {SOCIAL_PLATFORMS.map((p) => {
          const filled = !!values[p.key]?.trim();
          const isActive = activeKey === p.key;
          return (
            <button
              key={p.key}
              type="button"
              title={p.label}
              onClick={() => setActiveKey((k) => (k === p.key ? null : p.key))}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors"
              style={{
                borderColor: isActive ? accentColor : filled ? `${accentColor}88` : "rgba(255,255,255,0.14)",
                background: isActive ? `${accentColor}22` : filled ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.2)",
                color: isActive || filled ? "#fff" : "rgba(255,255,255,0.5)",
              }}
            >
              <SocialPlatformIcon platform={p} />
              {filled && (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-black"
                  style={{ background: accentColor, color: "#031A0E" }}
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={active.key}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div
              className="flex overflow-hidden rounded-[12px] border bg-black/20 transition-colors"
              style={{ borderColor: `${accentColor}70` }}
            >
              <span className="flex shrink-0 items-center gap-1.5 border-r border-white/10 bg-white/[0.04] px-3 text-[12px] font-semibold text-white/50">
                <SocialPlatformIcon platform={active} size={13} /> {active.prefix}
              </span>
              <input
                autoFocus
                type="text"
                value={values[active.key] ?? ""}
                onChange={(e) => onChange(active.key, e.target.value)}
                placeholder={active.placeholder}
                className="flex-1 bg-transparent px-3 py-3 text-[14px] text-white placeholder-white/25 outline-none"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
