"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Home, LogIn, MediaVideo, Movie, User, type IconProps } from "@/components/ui/icons";
import { useIsCreator } from "@/hooks/use-is-creator";
import { useIsGuest } from "@/hooks/use-is-guest";
import { TAB_BAR_PILL_HEIGHT_PX } from "@/lib/constants/layout";

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
];

/**
 * Navegación inferior para móvil y tableta (< lg): una píldora oscura flotante con cuatro accesos (icono y
 * etiqueta). El activo se resalta en verde sobre una cápsula suave. El visitante ve "Entrar" donde el resto ve
 * su espacio personal. El buscador está en la cabecera.
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
    // El contenedor ocupa todo el ancho pero no captura toques: solo la píldora es interactiva.
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] lg:hidden"
    >
      <ul
        className="pointer-events-auto mx-auto flex max-w-[380px] items-center justify-between gap-1 rounded-full bg-gma-surface-2/90 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl"
        style={{ height: TAB_BAR_PILL_HEIGHT_PX }}
      >
        {tabs.map(({ id, label, href, match, Icon }) => {
          const isActive = match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
          return (
            <li key={id} className="h-full min-w-0 flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[11px] font-medium leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white motion-reduce:transition-none ${
                  isActive ? "bg-white/[0.09] text-[#22B16B]" : "text-[#A4A4A4] active:text-white"
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2 : 1.6} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
