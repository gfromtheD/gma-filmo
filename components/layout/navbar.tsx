"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { ExternalLink, UserRound } from "lucide-react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useActiveProfileDisplay } from "@/hooks/use-active-profile-display";
import { useProfileStore } from "@/store/use-profile-store";
import { renderAvatar } from "@/lib/data/profile-avatars";
import { useIsGuest } from "@/hooks/use-is-guest";

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly match: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: "home",   label: "Home",       href: "/inicio",     match: "/inicio" },
  { id: "movies", label: "Cortos",     href: "/peliculas",  match: "/peliculas" },
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

  const isGuest = useIsGuest();

  const [menuOpen,   setMenuOpen]   = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Sliding pill ─────────────────────────────────────────────────────────
  const itemRefs  = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill]         = useState({ left: 0, width: 0 });
  const [pillReady, setPillReady] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    setMenuOpen(false);
    await getSupabaseBrowserClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function isActive(item: NavItem): boolean {
    if (item.match === "/") return pathname === "/";
    return pathname.startsWith(item.match);
  }

  // Measure active item and move the pill
  useEffect(() => {
    const activeIdx = NAV_ITEMS.findIndex((item) =>
      item.match === "/" ? pathname === "/" : pathname.startsWith(item.match)
    );
    if (activeIdx < 0) return;
    const el = itemRefs.current[activeIdx];
    if (!el) return;
    setPill({ left: el.offsetLeft, width: el.offsetWidth });
    setPillReady(true);
  }, [pathname]);

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
          {/* Sliding green pill — absolutely positioned behind the labels */}
          {pillReady && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 h-9 rounded-full bg-[#22B16B] transition-[left,width] duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{ left: pill.left, width: pill.width }}
            />
          )}

          {NAV_ITEMS.map((item, i) => {
            const active = isActive(item);
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
              type="button"
              aria-label="Cuenta"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full border border-[#262626] bg-[#0D0D0D] py-1 pl-1 pr-3 transition-colors hover:bg-[#1A1A1A]"
            >
              {isGuest ? <GuestAvatarIcon /> : <UserAvatar name={displayName} color={avatarColor} imageUrl={avatarImageUrl} iconId={avatarIconId} />}
              <span className="max-w-[120px] truncate text-[13px] font-semibold text-white">
                {isGuest ? "Invitado" : displayName}
              </span>
              <GmaIcon name="chevronDown" size={12} className="text-[#6D7D94]" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-[calc(100%+8px)] z-[200] w-[280px] overflow-hidden rounded-[14px] border border-[#262626] shadow-2xl"
                style={{ background: "#0D0D0D" }}
              >
                {/* Profile header — guest vs auth */}
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

                {/* Links */}
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

                {/* About */}
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

                {/* Sign out */}
                <div className="border-t border-[#262626] py-1">
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={signingOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-[#6D7D94] transition-colors hover:bg-[#1A1A1A] hover:text-[#ff5252] disabled:opacity-50"
                  >
                    <GmaIcon name="close" size={16} />
                    <span>{signingOut ? "Cerrando sesión…" : "Cerrar sesión"}</span>
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
