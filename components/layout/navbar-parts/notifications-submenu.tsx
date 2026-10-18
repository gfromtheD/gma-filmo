"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useEffect, useRef } from "react";
import { Bell, Star } from "iconoir-react";
import { notificationText, relativeTime } from "@/lib/notifications/rules";
import type { AppNotification } from "@/hooks/use-notifications";

/** Tiempo con la lista abierta antes de darlas por leídas, para que se vea cuáles eran nuevas. */
const MARK_READ_DELAY_MS = 1500;

interface Props {
  readonly items: readonly AppNotification[];
  readonly unread: number;
  readonly isLoaded: boolean;
  readonly itemClassName: string;
  readonly onMarkAllRead: () => void;
}

/**
 * «Notificaciones» dentro del menú de cuenta: al pasar por encima (o pulsar, en móvil) se despliega al lado la lista
 * de las últimas. Cada una lleva a las valoraciones de su obra; abajo, un acceso al Panel de Mi Estudio.
 */
export function NotificationsSubmenu({ items, unread, isLoaded, itemClassName, onMarkAllRead }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function handleOpenChange(isOpen: boolean) {
    clearTimeout(timer.current);
    if (isOpen && unread > 0) timer.current = setTimeout(onMarkAllRead, MARK_READ_DELAY_MS);
  }

  return (
    <DropdownMenu.Sub onOpenChange={handleOpenChange}>
      <DropdownMenu.SubTrigger className={`${itemClassName} data-[state=open]:bg-white/10`}>
        <Bell width={20} height={20} strokeWidth={1.8} aria-hidden="true" />
        <span className="flex-1">Notificaciones</span>
        {unread > 0 && (
          <span aria-label={`${unread} sin leer`} className="grid h-5 min-w-5 place-items-center rounded-full bg-[#22B16B] px-1.5 text-[11.5px] font-bold tabular-nums text-[#031A0E]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenu.SubTrigger>

      <DropdownMenu.Portal>
        <DropdownMenu.SubContent sideOffset={6} alignOffset={-8} collisionPadding={12}
          className="z-[210] w-[340px] max-w-[calc(100vw-24px)] rounded-[8px] bg-gma-border p-2 shadow-[0_18px_48px_rgba(0,0,0,0.7)] outline-none ring-1 ring-white/10 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <p className="px-3 pb-1.5 pt-2 text-[15px] font-extrabold text-white">Notificaciones</p>

          {!isLoaded ? (
            <p className="px-3 py-4 text-[13.5px] text-[#BBBBBB]">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-4 text-[13.5px] leading-5 text-[#BBBBBB]">Aún no tienes notificaciones. Te avisaremos aquí cuando valoren tus obras.</p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {items.map((n) => (
                <DropdownMenu.Item key={n.id} asChild>
                  <Link href={`/cortos/${encodeURIComponent(n.film.slug)}#valoraciones`}
                    className="flex items-start gap-3 rounded-[6px] px-3 py-2.5 outline-none transition-colors data-[highlighted]:bg-white/10">
                    <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#22B16B]/15 text-[#5FD39A]">
                      <Star width={16} height={16} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[14px] leading-5 ${n.isRead ? "text-[#D0D0D0]" : "font-semibold text-white"}`}>
                        {notificationText({ kind: n.kind, score: n.score, title: n.film.title })}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] text-[#9A9A9A]">{relativeTime(new Date(n.createdAt).getTime())}</span>
                    </span>
                    {!n.isRead && <span aria-label="Nueva" className="mt-2 size-2 shrink-0 rounded-full bg-[#22B16B]" />}
                  </Link>
                </DropdownMenu.Item>
              ))}
            </div>
          )}

          <DropdownMenu.Separator className="my-2 h-px bg-white/10" />
          <DropdownMenu.Item asChild>
            <Link href="/mi-estudio" className="flex h-11 items-center rounded-[6px] px-3 text-[14px] font-semibold text-[#5FD39A] outline-none transition-colors data-[highlighted]:bg-white/10">
              Ver tu audiencia en Mi Estudio
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
}
