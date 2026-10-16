"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
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
import { getNavItems, type NavItem } from "@/lib/layout/nav-items";

/** Qué sección del menú está activa según la ruta. */
function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname.startsWith(item.match);
}


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
  // Sección del menú recién pulsada: se queda en blanco (sin el verde del cursor) hasta que el cursor salga de ella.
  const [pressedNavId, setPressedNavId] = useState<string | null>(null);
  const [chipReveal,   setChipReveal]   = useState(false);
  const [pillExpanded, setPillExpanded] = useState(true);

  useEffect(() => {
    if (phase === "contracting") {
      setPillExpanded(false);
    } else if (prevPhase.current === "contracting" && phase === "idle") {
      setChipReveal(true);
      avatarCtrl.set({ opacity: 0 });
      void avatarCtrl.start({ opacity: 1, transition: { duration: 0.1, delay: 0.02, ease: "easeOut" } });
      const revealT = setTimeout(() => setChipReveal(false), 120);
      const expandT = setTimeout(() => setPillExpanded(true), 240);

      prevPhase.current = phase;
      return () => {
        clearTimeout(revealT);
        clearTimeout(expandT);
      };
    }
    prevPhase.current = phase;
  }, [phase, avatarCtrl]);

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

  const isStudioNav = isCreator && pathname.startsWith("/mi-estudio");
  const navRef = useRef<HTMLElement>(null);
  const { activeTab: studioTab, setActiveTab: setStudioTab } = useStudioTabStore();

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

  const navItems = getNavItems(isCreator);

  function handleStudioTabSelect(id: (typeof STUDIO_TABS)[number]["id"]) {
    setStudioTab(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <header
      data-scrolled={isScrolled}
      className="sticky top-0 z-50 bg-transparent transition-colors duration-300 ease-in data-[scrolled=true]:bg-gma-bg motion-reduce:transition-none"
    >
      <div className="relative grid h-14 grid-cols-[1fr_auto] items-center gap-2 px-4 lg:h-16 lg:grid-cols-[auto_auto_1fr] lg:gap-5 lg:px-16">
        {/* ── Left: menú móvil + marca ──────────────────────────────── */}
        <div className="flex items-center gap-1 lg:gap-0">
          <NavbarBrand />
        </div>

        {/* ── Menú de secciones: a la izquierda, junto a la marca ────── */}
        <nav
          ref={navRef}
          aria-label="Principal"
          className="relative hidden h-full items-stretch lg:flex"
        >
          <div className="flex items-stretch">
            {navItems.map((item) => {
              const active = isNavItemActive(item, pathname);
              const isPressed = pressedNavId === item.id;
              const hoverColor = isPressed ? "" : "hover:text-[#22B16B] ";
              const linkClass =
                `relative flex h-full items-center px-3.5 text-[16px] font-medium text-white transition-colors ${hoverColor}focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white`;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={linkClass}
                  onClick={() => setPressedNavId(item.id)}
                  onPointerLeave={() => setPressedNavId((current) => (current === item.id ? null : current))}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* ── Right: search + profile ───────────────────────────────── */}
        <div className="flex items-center justify-end gap-1 lg:gap-2 lg:justify-self-end">
          {isGuest && (
            <Link
              href="/?register=1"
              aria-label="Registrarse"
              className="mr-1 inline-flex h-8 shrink-0 max-sm:order-last items-center justify-center rounded-[4px] bg-[#22B16B] px-3 text-[13px] font-extrabold uppercase text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-[14px] lg:mr-2"
            >
              <span className="sm:hidden">Registro</span>
              <span className="hidden sm:inline">Registrarse</span>
            </Link>
          )}
          <Link
            href="/buscador"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-white lg:h-12 lg:w-12"
            aria-label="Buscador"
          >
            <GmaIcon name="search" size={28} />
          </Link>
          <Link
            href="/mi-espacio"
            aria-current={pathname.startsWith("/mi-espacio") ? "page" : undefined}
            className="hidden h-12 w-12 items-center justify-center rounded-full text-white transition-colors hover:text-[#22B16B] focus-visible:outline-2 focus-visible:outline-white lg:flex"
            aria-label="Mi lista"
          >
            <GmaIcon name="bookmark" size={28} />
          </Link>

          <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
          <div className={`relative ml-1.5 ${isGuest ? "hidden sm:block" : ""}`}>
            <DropdownMenu.Trigger asChild>
            <button
              ref={chipBtnRef}
              type="button"
              aria-label="Cuenta"
              className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none! lg:h-12 lg:w-12"
              style={{
                opacity: phase === "contracting" ? 0 : 1,
                pointerEvents: phase === "contracting" ? "none" : "auto",
                clipPath: pillExpanded
                  ? "inset(0% 0% 0% 0% round 9999px)"
                  : "inset(0% calc(100% - 40px) 0% 0% round 9999px)",
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
