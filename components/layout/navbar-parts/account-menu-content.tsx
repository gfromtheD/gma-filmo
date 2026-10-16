"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { Bookmark, ChatBubble, Dashboard, LogOut, NavArrowRight, OpenNewWindow, Settings, User } from "iconoir-react";
import { UserAvatar } from "@/components/layout/navbar-parts/avatars";

const ITEM_BASE =
  "flex h-12 w-full cursor-pointer items-center gap-4 rounded-[6px] px-3 text-[16px] font-medium outline-none transition-colors data-[disabled]:opacity-50 data-[highlighted]:bg-white/10";
const ITEM_CLASS = `${ITEM_BASE} text-white`;
const SIGN_OUT_CLASS = `${ITEM_BASE} text-[#BBBBBB] data-[highlighted]:text-[#FF6B6B]`;
const ICON_PROPS = { width: 20, height: 20, strokeWidth: 1.8, "aria-hidden": true } as const;
const DIVIDER = "my-2 h-px bg-white/10";

const PILL_FOCUS = "data-[highlighted]:outline-2 data-[highlighted]:outline-offset-2 data-[highlighted]:outline-white";

interface AccountMenuContentProps {
  readonly isGuest: boolean;
  readonly displayName: string;
  readonly email?: string | null;
  readonly avatarColor: string;
  readonly avatarImageUrl?: string;
  readonly avatarIconId?: string;
  readonly isCreator: boolean;
  readonly canOpenSettings: boolean;
  readonly isSigningOut: boolean;
  readonly onOpenMessages: () => void;
  readonly onSignOut: () => void;
}

/**
 * Contenido del menú de cuenta. Debe renderizarse dentro de `DropdownMenu.Root`:
 * Radix aporta role=menu, navegación con flechas, Escape y devolución del foco.
 */
export function AccountMenuContent({
  isGuest,
  displayName,
  email,
  avatarColor,
  avatarImageUrl,
  avatarIconId,
  isCreator,
  canOpenSettings,
  isSigningOut,
  onOpenMessages,
  onSignOut,
}: AccountMenuContentProps) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="z-[200] w-[304px] max-w-[calc(100vw-24px)] rounded-[8px] bg-gma-border p-2 shadow-[0_18px_48px_rgba(0,0,0,0.7)] outline-none ring-1 ring-white/10"
      >
        {isGuest ? (
          <div className="px-3 pb-2 pt-3">
            <div className="mb-3 flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gma-line-strong text-[#BBBBBB]">
                <User {...ICON_PROPS} />
              </div>
              <div className="min-w-0">
                <div className="text-[16px] font-extrabold leading-tight text-white">Explorando como invitado</div>
                <div className="text-[13px] text-[#BBBBBB]">Acceso limitado</div>
              </div>
            </div>
            <p className="mb-4 text-[13px] leading-[1.5] text-[#BBBBBB]">
              Crea una cuenta gratis para guardar favoritos, llevar tu historial y valorar cortos.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <DropdownMenu.Item asChild>
                <Link
                  href="/?register=1"
                  className={`flex h-10 items-center justify-center rounded-[4px] bg-[#22B16B] text-[13px] font-extrabold uppercase text-[#031A0E] outline-none transition-colors hover:bg-[#2AC57A] ${PILL_FOCUS}`}
                >
                  Registrarse
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/?login=1"
                  className={`flex h-10 items-center justify-center rounded-[4px] border border-white/25 text-[13px] font-extrabold uppercase text-white outline-none transition-colors hover:bg-white/10 ${PILL_FOCUS}`}
                >
                  Iniciar sesión
                </Link>
              </DropdownMenu.Item>
            </div>
          </div>
        ) : (
          <DropdownMenu.Item asChild>
            <Link
              href="/perfiles"
              className="flex items-center gap-4 rounded-[6px] p-3 outline-none transition-colors data-[highlighted]:bg-white/10"
            >
              <UserAvatar name={displayName} color={avatarColor} imageUrl={avatarImageUrl} iconId={avatarIconId} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-extrabold leading-tight text-white">{displayName}</div>
                {email && <div className="truncate text-[13px] text-[#BBBBBB]">{email}</div>}
                <div className="mt-0.5 text-[12px] font-bold text-[#22B16B]">Cambiar de perfil</div>
              </div>
              <NavArrowRight {...ICON_PROPS} className="shrink-0 text-[#BBBBBB]" />
            </Link>
          </DropdownMenu.Item>
        )}

        <DropdownMenu.Separator className={DIVIDER} />
        <div>
          <DropdownMenu.Item asChild>
            <Link href="/mi-espacio" className={ITEM_CLASS}>
              <Bookmark {...ICON_PROPS} />
              <span>Mi Espacio</span>
            </Link>
          </DropdownMenu.Item>
          {isCreator && (
            // En escritorio Mi Estudio está en la barra superior; en móvil/tableta solo se llega desde aquí.
            <DropdownMenu.Item asChild>
              <Link href="/mi-estudio" className={`${ITEM_CLASS} lg:hidden`}>
                <Dashboard {...ICON_PROPS} />
                <span>Mi Estudio</span>
              </Link>
            </DropdownMenu.Item>
          )}
          {isCreator && (
            <DropdownMenu.Item className={ITEM_CLASS} onSelect={onOpenMessages}>
              <ChatBubble {...ICON_PROPS} />
              <span>Mensajes directos</span>
            </DropdownMenu.Item>
          )}
          {canOpenSettings && (
            <DropdownMenu.Item asChild>
              <Link href="/configuracion" className={ITEM_CLASS}>
                <Settings {...ICON_PROPS} />
                <span>Configuración</span>
              </Link>
            </DropdownMenu.Item>
          )}
        </div>

        <DropdownMenu.Separator className={DIVIDER} />
        <div>
          <DropdownMenu.Item asChild>
            <a
              href="https://generacionmaldita.com/sobre-el-proyecto/"
              target="_blank"
              rel="noopener noreferrer"
              className={ITEM_CLASS}
            >
              <OpenNewWindow {...ICON_PROPS} />
              <span>Sobre el proyecto</span>
            </a>
          </DropdownMenu.Item>
        </div>

        <DropdownMenu.Separator className={DIVIDER} />
        <div>
          <DropdownMenu.Item className={SIGN_OUT_CLASS} disabled={isSigningOut} onSelect={onSignOut}>
            <LogOut {...ICON_PROPS} />
            <span>{isSigningOut ? "Saliendo…" : isGuest ? "Salir al inicio" : "Cerrar sesión"}</span>
          </DropdownMenu.Item>
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}
