"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { Dialog } from "radix-ui";
import { Home, LogIn, MediaVideo, Menu, Movie, Search, User, Xmark, Dashboard, type IconProps } from "@/components/ui/icons";
import { NavbarBrand } from "@/components/layout/navbar-parts/brand";
import { useIsCreator } from "@/hooks/use-is-creator";
import { useIsGuest } from "@/hooks/use-is-guest";

interface DrawerItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  /** Prefijos de ruta que dejan este acceso marcado como activo. */
  readonly match: readonly string[];
  readonly Icon: ComponentType<IconProps>;
}

const SECTIONS: readonly DrawerItem[] = [
  { id: "home", label: "Inicio", href: "/inicio", match: ["/inicio"], Icon: Home },
  { id: "movies", label: "Películas", href: "/peliculas", match: ["/peliculas"], Icon: Movie },
  { id: "shorts", label: "Cortos", href: "/cortos", match: ["/cortos"], Icon: MediaVideo },
];

/** Entrada y salida del panel (Material 3 recomienda 250–300 ms con desaceleración marcada). */
const PANEL_MS = 0.3;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** Arrastrar el panel hacia la izquierda más de esto (o con fuerza) lo cierra, como en las apps nativas. */
const SWIPE_CLOSE_PX = 80;
const SWIPE_CLOSE_VELOCITY = 500;
/** Desde esta anchura manda la cabecera de escritorio (`lg`). */
const DESKTOP_QUERY = "(min-width: 1024px)";

/** Respuesta táctil al pulsar: una vibración muy corta donde el navegador la permite (Android; Safari en iOS no). */
function tapFeedback() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
}

function isActive(item: DrawerItem, pathname: string): boolean {
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Navegación del móvil y la tableta (< lg): un botón de menú junto a la marca abre un panel lateral modal desde la
 * izquierda. Opciones grandes (zonas de 56 px, por encima de los 44 pt de Apple y 48 dp de Material), respuesta al
 * pulsar, entrada en cascada y cierre al tocar fuera, con Escape, al arrastrar hacia la izquierda o al navegar. Radix
 * se encarga del foco atrapado, del bloqueo del scroll de la página y de los roles accesibles.
 */
export function MobileNavDrawer() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const isGuest = useIsGuest();
  const { isCreator } = useIsCreator();

  // Al cambiar de página (o al pasar a escritorio) el panel se cierra solo.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => { if (query.matches) setOpen(false); };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const personal: DrawerItem[] = [
    isGuest
      ? { id: "login", label: "Entrar", href: "/?login=1", match: [], Icon: LogIn }
      : { id: "space", label: "Mi Espacio", href: "/mi-espacio", match: ["/mi-espacio", "/configuracion"], Icon: User },
    ...(isCreator ? [{ id: "studio", label: "Mi Estudio", href: "/mi-estudio", match: ["/mi-estudio"], Icon: Dashboard }] : []),
    { id: "search", label: "Buscar", href: "/buscador", match: ["/buscador"], Icon: Search },
  ];

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_CLOSE_PX || info.velocity.x < -SWIPE_CLOSE_VELOCITY) setOpen(false);
  };

  const itemMotion = (index: number) => reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
    : { initial: { opacity: 0, x: -18 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.32, ease: EASE_OUT, delay: 0.08 + index * 0.045 } };

  const renderItem = (item: DrawerItem, index: number, size: "large" | "small") => {
    const active = isActive(item, pathname);
    return (
      <motion.li key={item.id} {...itemMotion(index)}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          onPointerDown={tapFeedback}
          onClick={() => setOpen(false)}
          className={`group relative flex min-h-14 items-center gap-4 rounded-2xl px-4 transition-[background-color,color,transform] duration-150 active:scale-[0.97] active:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white motion-reduce:transition-none motion-reduce:active:scale-100 ${
            active ? "bg-[#22B16B]/[0.12] text-[#2AC57A]" : "text-white"
          } ${size === "large" ? "text-[26px] font-bold tracking-[-0.01em]" : "text-[18px] font-semibold"}`}
        >
          {active && <span aria-hidden="true" className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[#22B16B]" />}
          <item.Icon size={size === "large" ? 26 : 22} strokeWidth={active ? 2 : 1.7} className={active ? "" : "text-white/70"} />
          {item.label}
        </Link>
      </motion.li>
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Abrir el menú"
          onPointerDown={tapFeedback}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-white transition-[background-color,transform] duration-150 active:scale-90 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none lg:hidden"
        >
          <Menu size={26} />
        </button>
      </Dialog.Trigger>

      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[3px] lg:hidden"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.25 }}
              />
            </Dialog.Overlay>
            {/* Al abrir, el foco va al panel (no al botón de cerrar): así no aparece su aro de foco al tocar con el dedo y
                el teclado y el lector de pantalla siguen dentro del panel. */}
            <Dialog.Content asChild forceMount aria-describedby={undefined}
              onOpenAutoFocus={(event) => { event.preventDefault(); panelRef.current?.focus({ preventScroll: true }); }}>
              <motion.div
                ref={panelRef}
                tabIndex={-1}
                className="fixed inset-y-0 left-0 z-[61] flex w-[min(86vw,380px)] flex-col overflow-y-auto rounded-r-[28px] bg-[var(--gma-preview)] pb-[calc(20px+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)] shadow-[24px_0_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10 outline-none lg:hidden"
                style={{ backgroundImage: "radial-gradient(140% 60% at 0% 100%, rgba(91,63,209,0.28) 0%, rgba(91,63,209,0) 70%), radial-gradient(120% 50% at 0% 0%, rgba(34,177,107,0.16) 0%, rgba(34,177,107,0) 70%)" }}
                initial={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
                animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
                transition={{ duration: reduceMotion ? 0.12 : PANEL_MS, ease: EASE_OUT }}
                drag={reduceMotion ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.5, right: 0 }}
                dragSnapToOrigin
                onDragEnd={onDragEnd}
              >
                <Dialog.Title className="sr-only">Menú</Dialog.Title>
                <div className="flex h-14 items-center justify-between pl-4 pr-3">
                  <NavbarBrand />
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Cerrar el menú"
                      onPointerDown={tapFeedback}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-[background-color,transform] duration-150 active:scale-90 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none"
                    >
                      <Xmark size={24} />
                    </button>
                  </Dialog.Close>
                </div>

                <nav aria-label="Navegación principal" className="flex flex-1 flex-col px-3 pt-6">
                  <ul className="flex flex-col gap-1">{SECTIONS.map((item, i) => renderItem(item, i, "large"))}</ul>
                  <div aria-hidden="true" className="mx-4 my-5 h-px bg-white/10" />
                  <ul className="flex flex-col gap-1">{personal.map((item, i) => renderItem(item, SECTIONS.length + i, "small"))}</ul>
                </nav>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
