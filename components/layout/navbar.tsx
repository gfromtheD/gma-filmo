"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, useAnimation, AnimatePresence } from "motion/react";
import { ExternalLink, UserRound } from "lucide-react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useActiveProfileDisplay } from "@/hooks/use-active-profile-display";
import { useProfileStore } from "@/store/use-profile-store";
import { renderAvatar } from "@/lib/data/profile-avatars";
import { useIsGuest } from "@/hooks/use-is-guest";
import { useIsCreator } from "@/hooks/use-is-creator";
import { useTransitionStore } from "@/store/use-transition-store";

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly match: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: "home",   label: "Home",       href: "/inicio",     match: "/inicio" },
  { id: "movies", label: "Películas",  href: "/peliculas",  match: "/peliculas" },
  { id: "cortos", label: "Cortos",     href: "/cortos",     match: "/cortos" },
  { id: "space",  label: "Mi Espacio", href: "/mi-espacio", match: "/mi-espacio" },
];


function UserAvatar({ name, color, imageUrl, iconId }: { name: string; color: string; imageUrl?: string; iconId?: string }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
    );
  }
  if (iconId) {
    return (
      <div className="h-7 w-7 overflow-hidden rounded-full">
        {renderAvatar(iconId, color, 28) as React.ReactNode}
      </div>
    );
  }
  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-extrabold text-[#031A0E]"
      style={{ background: color }}
    >
      {name[0]?.toUpperCase() ?? "U"}
    </div>
  );
}

function GuestAvatarIcon() {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#3A4A5A] bg-[#1A2535]">
      <UserRound size={15} className="text-[#B8C5D4]" />
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { email } = useUserProfile();
  const { displayName, avatarColor, avatarImageUrl, avatarIconId } = useActiveProfileDisplay();
  const activeProfile = useProfileStore((s) => s.activeProfile);

  const isGuest      = useIsGuest();
  const { isCreator } = useIsCreator();
  const setChipPos   = useTransitionStore((s) => s.setChipPos);
  const phase        = useTransitionStore((s) => s.phase);
  const chipBtnRef   = useRef<HTMLButtonElement>(null);
  const avatarRef    = useRef<HTMLSpanElement>(null);
  const prevPhase    = useRef(phase);
  const avatarCtrl   = useAnimation();
  const [chipReveal,   setChipReveal]   = useState(false);
  const [pillExpanded, setPillExpanded] = useState(true);

  // ── Slot-machine roulette state (0=Mi Espacio, 1=Mi Estudio) ─────────────
  const [rouletteStep, setRouletteStep] = useState(
    () => (pathname.startsWith("/mi-estudio") ? 1 : 0)
  );

  useEffect(() => {
    if (phase === "contracting") {
      setPillExpanded(false);
    } else if (prevPhase.current === "contracting" && phase === "idle") {
      setChipReveal(true);
      avatarCtrl.set({ opacity: 0 });
      void avatarCtrl.start({ opacity: 1, transition: { duration: 0.1, delay: 0.02, ease: "easeOut" } });
      const revealT = setTimeout(() => setChipReveal(false), 120);
      const expandT = setTimeout(() => setPillExpanded(true), 240);

      // Trigger roulette for creators after pill has expanded
      let r1: ReturnType<typeof setTimeout> | undefined;
      let r2: ReturnType<typeof setTimeout> | undefined;
      if (isCreator) {
        r1 = setTimeout(() => setRouletteStep(1), 500);   // → Mi Estudio
        r2 = setTimeout(() => setRouletteStep(0), 1900);  // → Mi Espacio
      }

      prevPhase.current = phase;
      return () => {
        clearTimeout(revealT);
        clearTimeout(expandT);
        if (r1) clearTimeout(r1);
        if (r2) clearTimeout(r2);
      };
    }
    prevPhase.current = phase;
  }, [phase, avatarCtrl, isCreator]);

  const [menuOpen,   setMenuOpen]   = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function measure() {
      const el = avatarRef.current ?? chipBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setChipPos({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [setChipPos]);

  // ── Sliding pill ─────────────────────────────────────────────────────────
  const itemRefs   = useRef<(HTMLElement | null)[]>([]);
  const [pill, setPill]         = useState({ left: 0, width: 0 });
  const [pillReady, setPillReady] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    setMenuOpen(false);
    if (isGuest) {
      document.cookie = "gma_guest=; path=/; max-age=0; SameSite=Lax";
      router.push("/");
      return;
    }
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/");
    router.refresh();
  }, [router, isGuest]);

  // Close profile menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // "Mi Espacio" is active when on /mi-espacio OR (creator) /mi-estudio
  const spaceIsActive = useMemo(() => {
    return pathname.startsWith("/mi-espacio") || (isCreator && pathname.startsWith("/mi-estudio"));
  }, [pathname, isCreator]);

  function isActive(item: NavItem): boolean {
    if (item.id === "space") return spaceIsActive;
    if (item.match === "/") return pathname === "/";
    return pathname.startsWith(item.match);
  }

  // Sync roulette label with current route (only when no animation is running)
  useEffect(() => {
    if (phase !== "idle") return;
    setRouletteStep(pathname.startsWith("/mi-estudio") ? 1 : 0);
  }, [pathname, phase]);

  // Toggle between Mi Espacio ↔ Mi Estudio with roulette animation on the pill
  function handleSpacePillClick() {
    if (!isCreator || !spaceIsActive) {
      router.push("/mi-espacio");
      return;
    }
    const targetHref = pathname.startsWith("/mi-estudio") ? "/mi-espacio" : "/mi-estudio";
    const targetStep = targetHref === "/mi-estudio" ? 1 : 0;
    setRouletteStep(targetStep);
    setTimeout(() => router.push(targetHref), 420);
  }

  // Measure active pill position
  useEffect(() => {
    const activeIdx = NAV_ITEMS.findIndex((item) => isActive(item));
    if (activeIdx < 0) return;
    const el = itemRefs.current[activeIdx];
    if (!el) return;
    setPill({ left: el.offsetLeft, width: el.offsetWidth });
    setPillReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, spaceIsActive]);

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0) 100%)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div
        className="mx-auto max-w-[1440px] px-8"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          height: 80,
          gap: 32,
        }}
      >
        {/* ── Left: brand ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-gma.png" alt="GMA" className="h-8 w-auto" />
            <span className="text-[18px] text-white">·</span>
            <span className="text-[14px] font-medium uppercase tracking-[0.04em] text-[#22B16B]">
              filmo
            </span>
          </Link>
          <span className="h-[18px] w-px bg-[#2A2A2A]" />
          <span
            className="text-[13px] text-[#6D7D94]"
            style={{ fontFamily: '"Georgia", "Times New Roman", serif', fontStyle: "italic" }}
          >
            el cine es nuestro
          </span>
        </div>

        {/* ── Center: pill nav ──────────────────────────────────────── */}
        <nav
          className="relative flex gap-1 rounded-full border border-[#262626] p-1"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          {pillReady && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 h-9 rounded-full bg-[#22B16B] transition-[left,width] duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{ left: pill.left, width: pill.width }}
            />
          )}

          {NAV_ITEMS.map((item, i) => {
            const active = isActive(item);
            const labelColor = active ? "#051910" : "#B8C5D4";

            // ── Space tab (creator: click toggles Mi Espacio ↔ Mi Estudio) ──
            if (item.id === "space" && isCreator) {
              return (
                <div
                  key={item.id}
                  ref={(el) => { itemRefs.current[i] = el; }}
                  className="relative z-10 flex h-9 cursor-pointer items-center rounded-full px-5"
                  onClick={handleSpacePillClick}
                >
                  {/* Slot-machine roulette — two labels stacked, clip to one row */}
                  <span
                    className="inline-block overflow-hidden text-[13.5px] font-semibold transition-colors duration-[260ms]"
                    style={{ height: "1.2em", lineHeight: "1.2em", color: labelColor }}
                  >
                    <motion.span
                      className="flex flex-col"
                      animate={{ y: rouletteStep === 0 ? "0em" : "-1.2em" }}
                      transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <span style={{ height: "1.2em", lineHeight: "1.2em", display: "block", whiteSpace: "nowrap" }}>Mi Espacio</span>
                      <span style={{ height: "1.2em", lineHeight: "1.2em", display: "block", whiteSpace: "nowrap" }}>Mi Estudio</span>
                    </motion.span>
                  </span>
                </div>
              );
            }

            // ── Normal tab ───────────────────────────────────────────
            return (
              <Link
                key={item.id}
                href={item.href}
                ref={(el) => { itemRefs.current[i] = el; }}
                className="relative z-10 flex h-9 items-center rounded-full px-5 text-[13.5px] font-semibold transition-colors duration-[260ms]"
                style={{ color: active ? "#051910" : "#B8C5D4" }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Right: search + profile ───────────────────────────────── */}
        <div className="flex items-center justify-end gap-1">
          <Link
            href="/buscador"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white"
            aria-label="Buscador"
          >
            <GmaIcon name="search" size={19} />
          </Link>

          <div ref={menuRef} className="relative ml-1.5">
            <button
              ref={chipBtnRef}
              type="button"
              aria-label="Cuenta"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full border border-[#262626] bg-[#0D0D0D] py-1 pl-1 pr-3 hover:bg-[#1A1A1A]"
              style={{
                opacity: phase === "contracting" ? 0 : 1,
                pointerEvents: phase === "contracting" ? "none" : "auto",
                clipPath: pillExpanded
                  ? "inset(0% 0% 0% 0% round 9999px)"
                  : "inset(0% calc(100% - 32px) 0% 0% round 9999px)",
                transition: pillExpanded
                  ? "clip-path 0.38s cubic-bezier(0.22,1,0.36,1), background-color 0.2s"
                  : "none",
              }}
            >
              <span ref={avatarRef} style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                <AnimatePresence>
                  {chipReveal && (
                    <motion.span
                      key="green-overlay"
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "9999px",
                        background: "#22B16B",
                        zIndex: 1,
                        pointerEvents: "none",
                      }}
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1, ease: "easeInOut" }}
                    />
                  )}
                </AnimatePresence>
                <motion.span className="inline-flex shrink-0" animate={avatarCtrl}>
                  {isGuest ? <GuestAvatarIcon /> : <UserAvatar name={displayName} color={avatarColor} imageUrl={avatarImageUrl} iconId={avatarIconId} />}
                </motion.span>
              </span>
              <span className="max-w-[120px] truncate text-[13px] font-semibold text-white whitespace-nowrap">
                {isGuest ? "Invitado" : displayName}
              </span>
              <GmaIcon name="chevronDown" size={12} className="text-[#6D7D94] shrink-0" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-[calc(100%+8px)] z-[200] w-[280px] overflow-hidden rounded-[14px] border border-[#262626] shadow-2xl"
                style={{ background: "#0D0D0D" }}
              >
                {isGuest ? (
                  <div className="border-b border-[#262626] px-4 py-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#3A4A5A] bg-[#1A2535]">
                        <UserRound size={18} className="text-[#B8C5D4]" />
                      </div>
                      <div>
                        <div className="text-[13px] font-extrabold text-white">Explorando como invitado</div>
                        <div className="text-[11px] text-[#5A6A7E]">Acceso limitado</div>
                      </div>
                    </div>
                    <p className="mb-3 text-[11.5px] leading-[1.5] text-[#6D7D94]">
                      Crea una cuenta gratis para guardar favoritos, llevar tu historial y valorar cortos.
                    </p>
                    <div className="flex gap-2">
                      <Link
                        href="/?register=1"
                        onClick={() => setMenuOpen(false)}
                        className="flex-1 rounded-full bg-[#22B16B] py-1.5 text-center text-[12px] font-bold text-[#031A0E] transition-opacity hover:opacity-90"
                      >
                        Registrarse
                      </Link>
                      <Link
                        href="/?login=1"
                        onClick={() => setMenuOpen(false)}
                        className="flex-1 rounded-full border border-[#3A4A5A] py-1.5 text-center text-[12px] font-semibold text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A]"
                      >
                        Iniciar sesión
                      </Link>
                    </div>
                  </div>
                ) : (
                  <Link
                    href="/perfiles"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 border-b border-[#262626] px-4 py-3 transition-colors hover:bg-[#1A1A1A]"
                  >
                    <UserAvatar name={displayName} color={avatarColor} imageUrl={avatarImageUrl} iconId={avatarIconId} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-extrabold text-white">{displayName}</div>
                      {email && (
                        <div className="truncate text-[11px] text-[#5A6A7E]">{email}</div>
                      )}
                    </div>
                    <GmaIcon name="chevronRight" size={16} className="text-[#6D7D94]" />
                  </Link>
                )}

                <div className="py-1">
                  <Link
                    href="/mi-espacio"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white"
                  >
                    <GmaIcon name="bookmark" size={16} />
                    <span>Mi Espacio</span>
                  </Link>
                  {!activeProfile?.isKids && (
                    <Link
                      href="/configuracion"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white"
                    >
                      <GmaIcon name="settings" size={16} />
                      <span>Configuración</span>
                    </Link>
                  )}
                </div>

                <div className="border-t border-[#262626] py-1">
                  <a
                    href="https://generacionmaldita.com/sobre-el-proyecto/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white"
                  >
                    <ExternalLink size={16} />
                    <span>Sobre el proyecto</span>
                  </a>
                </div>

                <div className="border-t border-[#262626] py-1">
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={signingOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[#6D7D94] transition-colors hover:bg-[#1A1A1A] hover:text-[#ff5252] disabled:opacity-50"
                  >
                    <GmaIcon name="close" size={16} />
                    <span>{signingOut ? "Saliendo…" : isGuest ? "Salir al inicio" : "Cerrar sesión"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
