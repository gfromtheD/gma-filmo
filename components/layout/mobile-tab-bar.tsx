"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Home, LogIn, MediaVideo, Movie, Search, User, type IconProps } from "@/components/ui/icons";
import { useIsCreator } from "@/hooks/use-is-creator";
import { useIsGuest } from "@/hooks/use-is-guest";
import { TAB_BAR_HEIGHT_PX } from "@/lib/constants/layout";

interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  /** Prefijos de ruta que dejan este acceso marcado como activo. */
  readonly match: readonly string[];
  readonly Icon: ComponentType<IconProps>;
}

const BASE_TABS: readonly TabItem[] = [
  { id: "home", label: "Inicio", href: "/inicio", match: ["/inicio"], Icon: Home },
  { id: "movies", label: "Películas", href: "/peliculas", match: ["/peliculas"], Icon: Movie },
  { id: "shorts", label: "Cortos", href: "/cortos", match: ["/cortos"], Icon: MediaVideo },
  { id: "search", label: "Buscar", href: "/buscador", match: ["/buscador"], Icon: Search },
];

/**
 * Barra de navegación inferior para móvil y tableta (< lg): cinco accesos con icono y etiqueta, el activo
 * en verde con una marca arriba. El visitante ve "Entrar" donde el resto ve su espacio personal.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const isGuest = useIsGuest();
  const { isCreator } = useIsCreator();

  const accountTab: TabItem = isGuest
    ? { id: "login", label: "Entrar", href: "/?login=1", match: [], Icon: LogIn }
    : {
        id: "space",
        label: "Mi Espacio",
        href: "/mi-espacio",
        match: isCreator ? ["/mi-espacio", "/mi-estudio", "/configuracion"] : ["/mi-espacio", "/configuracion"],
        Icon: User,
      };
  const tabs = [...BASE_TABS, accountTab];

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#080816]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid max-w-[640px] grid-cols-5" style={{ height: TAB_BAR_HEIGHT_PX }}>
        {tabs.map(({ id, label, href, match, Icon }) => {
          const isActive = match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
          return (
            <li key={id} className="min-w-0">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white motion-reduce:transition-none ${
                  isActive ? "text-[#22B16B]" : "text-[#9AA3B5] active:text-white"
                }`}
              >
                {isActive && <span aria-hidden="true" className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-[#22B16B]" />}
                <Icon size={24} strokeWidth={isActive ? 2 : 1.6} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
