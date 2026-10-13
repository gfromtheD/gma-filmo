"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, useAnimation, AnimatePresence, useReducedMotion } from "motion/react";
import { DropdownMenu } from "radix-ui";
import { UserAvatar, GuestAvatarIcon } from "@/components/layout/navbar-parts/avatars";
import { NavbarBrand } from "@/components/layout/navbar-parts/brand";
import { AccountMenuContent } from "@/components/layout/navbar-parts/account-menu-content";
import { StudioTabsRow } from "@/components/layout/navbar-parts/studio-tabs-row";
import { GmaIcon } from "@/components/ui/gma-icon";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useActiveProfileDisplay } from "@/hooks/use-active-profile-display";
import { useProfileStore } from "@/store/use-profile-store";
import { useIsGuest } from "@/hooks/use-is-guest";
import { useIsCreator } from "@/hooks/use-is-creator";
import { useTransitionStore } from "@/store/use-transition-store";
import { useStudioTabStore } from "@/store/use-studio-tab-store";
import { STUDIO_TABS } from "@/components/features/studio/studio-sub-nav";
import { useDMStore } from "@/store/use-dm-store";
import { useScrollThreshold } from "@/hooks/use-scroll-threshold";

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly match: string;
}

/** Espera de la ruleta Mi Espacio ↔ Mi Estudio antes de navegar. */
const ROULETTE_DELAY_MS = 420;

const NAV_ITEMS: readonly NavItem[] = [
  { id: "home",   label: "Home",       href: "/inicio",     match: "/inicio" },
  { id: "movies", label: "Películas",  href: "/peliculas",  match: "/peliculas" },
  { id: "cortos", label: "Cortos",     href: "/cortos",     match: "/cortos" },
  { id: "space",  label: "Mi Espacio", href: "/mi-espacio", match: "/mi-espacio" },
];


export function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { email } = useUserProfile();
  const { displayName, avatarColor, avatarImageUrl, avatarIconId } = useActiveProfileDisplay();
  const activeProfile = useProfileStore((s) => s.activeProfile);

  const isGuest      = useIsGuest();
  const { isCreator } = useIsCreator();
  const openDM = useDMStore((s) => s.open);
  const setChipPos   = useTransitionStore((s) => s.setChipPos);
  const phase        = useTransitionStore((s) => s.phase);
  const chipBtnRef   = useRef<HTMLButtonElement>(null);
  const avatarRef    = useRef<HTMLSpanElement>(null);
  const prevPhase    = useRef(phase);
  const avatarCtrl   = useAnimation();
  const reduceMotion = useReducedMotion();
  const isScrolled    = useScrollThreshold();
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

      // Trigger roulette for creators after pill has expanded — ends on Mi Estudio
      let r1: ReturnType<typeof setTimeout> | undefined;
      if (isCreator) {
        r1 = setTimeout(() => setRouletteStep(1), 500);   // → Mi Estudio (stays)
      }

      prevPhase.current = phase;
      return () => {
        clearTimeout(revealT);
        clearTimeout(expandT);
        if (r1) clearTimeout(r1);
      };
    }
    prevPhase.current = phase;
  }, [phase, avatarCtrl, isCreator]);

  const [menuOpen,   setMenuOpen]   = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  // ── Studio sub-nav (second row of compound nav) ───────────────────────────
  const { activeTab: studioTab, setActiveTab: setStudioTab } = useStudioTabStore();
  const studioTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [studioTabPill, setStudioTabPill]           = useState({ left: 0, width: 0 });
  const [studioTabPillReady, setStudioTabPillReady] = useState(false);
  const isStudioNav = isCreator && pathname.startsWith("/mi-estudio");
  const navRef = useRef<HTMLElement>(null);


  // El subrayado se recalcula si la barra cambia de tamaño (p. ej. móvil → escritorio).
  useEffect(() => {
    if (!isStudioNav) { setStudioTabPillReady(false); return; }
    function measure() {
      const idx = STUDIO_TABS.findIndex((t) => t.id === studioTab);
      const el  = studioTabRefs.current[idx];
      if (!el || el.offsetWidth === 0) return;
      setStudioTabPill((prev) =>
        prev.left === el.offsetLeft && prev.width === el.offsetWidth
          ? prev
          : { left: el.offsetLeft, width: el.offsetWidth },
      );
      setStudioTabPillReady(true);
    }
    measure();
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [studioTab, isStudioNav]);

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
  // Creators default to Mi Estudio on any page; viewers always Mi Espacio
  useEffect(() => {
    if (phase !== "idle") return;
    if (pathname.startsWith("/mi-estudio")) {
      setRouletteStep(1);
    } else if (pathname.startsWith("/mi-espacio")) {
      setRouletteStep(0);
    } else {
      setRouletteStep(isCreator ? 1 : 0);
    }
  }, [pathname, phase, isCreator]);

  // Navegación diferida de la ruleta; se cancela al desmontar o al repetir el clic.
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); }, []);

  function pushAfterRoulette(href: string) {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    navTimerRef.current = setTimeout(() => router.push(href), reduceMotion ? 0 : ROULETTE_DELAY_MS);
  }

  // Toggle between Mi Espacio ↔ Mi Estudio with roulette animation on the pill
  function handleSpacePillClick() {
    if (!isCreator) {
      router.push("/mi-espacio");
      return;
    }
    if (!spaceIsActive) {
      // Creator on any other page: pill takes them to their default (Mi Estudio)
      setRouletteStep(1);
      pushAfterRoulette("/mi-estudio");
      return;
    }
    // Creator already in space section: toggle between Mi Espacio ↔ Mi Estudio
    const targetHref = pathname.startsWith("/mi-estudio") ? "/mi-espacio" : "/mi-estudio";
    const targetStep = targetHref === "/mi-estudio" ? 1 : 0;
    setRouletteStep(targetStep);
    pushAfterRoulette(targetHref);
  }

  function handleStudioTabSelect(id: (typeof STUDIO_TABS)[number]["id"]) {
    setStudioTab(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <header
      data-scrolled={isScrolled}
      className="sticky top-0 z-50 bg-transparent transition-colors duration-300 ease-in data-[scrolled=true]:bg-[#060613] motion-reduce:transition-none"
    >
      <div className="relative grid h-14 grid-cols-[1fr_auto] items-center gap-2 px-4 lg:h-16 lg:grid-cols-[1fr_auto_1fr] lg:gap-8 lg:px-20 xl:px-24">
        {/* ── Left: menú móvil + marca ──────────────────────────────── */}
        <div className="flex items-center gap-1 lg:gap-0">
          <NavbarBrand />
        </div>

        {/* ── Center: compound nav (single border wraps both rows) ────── */}
        <nav
          ref={navRef}
          aria-label="Principal"
          className="relative hidden h-full items-stretch lg:flex"
        >
          <div className="flex items-stretch">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              const linkClass =
                "relative flex h-full items-center px-3.5 text-[16px] font-medium text-white transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white after:absolute after:inset-x-3.5 after:bottom-0 after:h-[3px] after:bg-[#22B16B] after:opacity-0 aria-[current=page]:after:opacity-100";

              if (item.id === "space" && isCreator) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={rouletteStep === 0 ? "Mi Espacio" : "Mi Estudio"}
                    aria-current={active ? "page" : undefined}
                    className={`${linkClass} cursor-pointer`}
                    onClick={handleSpacePillClick}
                  >
                    <span
                      className="inline-block overflow-hidden"
                      style={{ height: "1.2em", lineHeight: "1.2em" }}
                    >
                      <motion.span
                        className="flex flex-col"
                        animate={{ y: rouletteStep === 0 ? "0em" : "-1.2em" }}
                        transition={{ duration: reduceMotion ? 0 : 0.38, ease: [0.4, 0, 0.2, 1] }}
                      >
                        <span style={{ height: "1.2em", lineHeight: "1.2em", display: "block", whiteSpace: "nowrap" }}>Mi Espacio</span>
                        <span style={{ height: "1.2em", lineHeight: "1.2em", display: "block", whiteSpace: "nowrap" }}>Mi Estudio</span>
                      </motion.span>
                    </span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={linkClass}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* ── Studio tabs: debajo de la barra, fuera del flujo ── */}
          {isStudioNav && (
            <motion.div
              style={{
                position: "absolute",
                top: "100%",
                marginTop: 8,
                left: 0,
                zIndex: 2,
                display: "flex",
                gap: 4,
                padding: 4,
                borderRadius: 999,
                background: "rgba(3,4,8,0.96)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
              initial={reduceMotion ? false : { clipPath: "inset(0 44% 0 44% round 999px)" }}
              animate={{ clipPath: "inset(0 0% 0 0% round 999px)" }}
              transition={reduceMotion ? { duration: 0 } : { delay: 0.16, type: "spring", stiffness: 260, damping: 28, mass: 0.9 }}
            >
              {studioTabPillReady && (
                <motion.span
                  aria-hidden="true"
                  style={{
                    position: "absolute", bottom: 4, height: 2,
                    borderRadius: 999,
                    background: "#22B16B",
                    pointerEvents: "none",
                  }}
                  animate={{ left: studioTabPill.left, width: studioTabPill.width }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38, mass: 0.7 }}
                />
              )}
              {STUDIO_TABS.map((tab, i) => (
                <button
                  key={tab.id}
                  ref={(el) => { studioTabRefs.current[i] = el; }}
                  onClick={() => handleStudioTabSelect(tab.id)}
                  style={{
                    position: "relative", zIndex: 10,
                    display: "flex", alignItems: "center", gap: 7,
                    height: 36, padding: "0 18px",
                    borderRadius: 999,
                    background: "transparent", border: "none", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    color: studioTab === tab.id ? "#22B16B" : "#B8C5D4",
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </motion.div>
          )}
        </nav>

        {/* ── Right: search + profile ───────────────────────────────── */}
        <div className="flex items-center justify-end gap-1 lg:gap-2 lg:justify-self-end">
          {isGuest && (
            <Link
              href="/?register=1"
              className="mr-1 inline-flex h-8 w-[120px] max-sm:order-last items-center justify-center rounded-[4px] bg-[#22B16B] text-[14px] font-extrabold uppercase text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:mr-2 lg:w-auto lg:px-3"
            >
              Registrarse
            </Link>
          )}
          <Link
            href="/buscador"
            className="hidden h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-white lg:flex lg:h-10 lg:w-10"
            aria-label="Buscador"
          >
            <GmaIcon name="search" size={22} />
          </Link>
          <Link
            href="/mi-espacio"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-white lg:flex"
            aria-label="Mi lista"
          >
            <GmaIcon name="bookmark" size={22} />
          </Link>

          <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
          <div className={`relative ml-1.5 ${isGuest ? "hidden sm:block" : ""}`}>
            <DropdownMenu.Trigger asChild>
            <button
              ref={chipBtnRef}
              type="button"
              aria-label="Cuenta"
              className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none! lg:h-10 lg:w-10"
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
              
            </button>
            </DropdownMenu.Trigger>

            <AccountMenuContent
              isGuest={isGuest}
              displayName={displayName}
              email={email}
              avatarColor={avatarColor}
              avatarImageUrl={avatarImageUrl}
              avatarIconId={avatarIconId}
              isCreator={isCreator}
              canOpenSettings={!activeProfile?.isKids}
              isSigningOut={signingOut}
              onOpenMessages={openDM}
              onSignOut={() => void handleSignOut()}
            />
          </div>
          </DropdownMenu.Root>
        </div>
      </div>

      {isStudioNav && (
        <StudioTabsRow tabs={STUDIO_TABS} activeId={studioTab} onSelect={handleStudioTabSelect} />
      )}
    </header>
  );
}
