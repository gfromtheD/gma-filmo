"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { ExternalLink, MessageCircle, UserRound } from "lucide-react";
import { GmaIcon } from "@/components/ui/gma-icon";
import { UserAvatar } from "@/components/layout/navbar-parts/avatars";

const ITEM_BASE =
  "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-[13px] font-semibold outline-none transition-colors data-[disabled]:opacity-50 data-[highlighted]:bg-[#1A1A1A]";
const ITEM_CLASS = `${ITEM_BASE} text-[#B8C5D4] data-[highlighted]:text-white`;
const SIGN_OUT_CLASS = `${ITEM_BASE} text-[#6D7D94] data-[highlighted]:text-[#ff5252]`;

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
        className="z-[200] w-[280px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[14px] border border-[#262626] bg-[#0D0D0D] shadow-2xl outline-none"
      >
        {isGuest ? (
          <div className="border-b border-[#262626] px-4 py-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#3A4A5A] bg-[#1A2535]">
                <UserRound size={18} className="text-[#B8C5D4]" aria-hidden="true" />
              </div>
              <div>
                <div className="text-[13px] font-extrabold text-white">Explorando como invitado</div>
                <div className="text-[11px] text-[#6D7D94]">Acceso limitado</div>
              </div>
            </div>
            <p className="mb-3 text-[11.5px] leading-[1.5] text-[#6D7D94]">
              Crea una cuenta gratis para guardar favoritos, llevar tu historial y valorar cortos.
            </p>
            <div className="flex gap-2">
              <DropdownMenu.Item asChild>
                <Link
                  href="/?register=1"
                  className={`flex-1 rounded-full bg-[#22B16B] py-1.5 text-center text-[12px] font-bold text-[#031A0E] outline-none transition-opacity hover:opacity-90 ${PILL_FOCUS}`}
                >
                  Registrarse
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/?login=1"
                  className={`flex-1 rounded-full border border-[#3A4A5A] py-1.5 text-center text-[12px] font-semibold text-[#B8C5D4] outline-none transition-colors hover:bg-[#1A1A1A] ${PILL_FOCUS}`}
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
              className="flex items-center gap-3 border-b border-[#262626] px-4 py-3 outline-none transition-colors data-[highlighted]:bg-[#1A1A1A]"
            >
              <UserAvatar name={displayName} color={avatarColor} imageUrl={avatarImageUrl} iconId={avatarIconId} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-extrabold text-white">{displayName}</div>
                {email && <div className="truncate text-[11px] text-[#6D7D94]">{email}</div>}
              </div>
              <GmaIcon name="chevronRight" size={16} className="text-[#6D7D94]" />
            </Link>
          </DropdownMenu.Item>
        )}

        <div className="py-1">
          <DropdownMenu.Item asChild>
            <Link href="/mi-espacio" className={ITEM_CLASS}>
              <GmaIcon name="bookmark" size={16} />
              <span>Mi Espacio</span>
            </Link>
          </DropdownMenu.Item>
          {isCreator && (
            <DropdownMenu.Item className={ITEM_CLASS} onSelect={onOpenMessages}>
              <MessageCircle size={16} aria-hidden="true" />
              <span>Mensajes directos</span>
            </DropdownMenu.Item>
          )}
          {canOpenSettings && (
            <DropdownMenu.Item asChild>
              <Link href="/configuracion" className={ITEM_CLASS}>
                <GmaIcon name="settings" size={16} />
                <span>Configuración</span>
              </Link>
            </DropdownMenu.Item>
          )}
        </div>

        <DropdownMenu.Separator className="h-px bg-[#262626]" />
        <div className="py-1">
          <DropdownMenu.Item asChild>
            <a
              href="https://generacionmaldita.com/sobre-el-proyecto/"
              target="_blank"
              rel="noopener noreferrer"
              className={ITEM_CLASS}
            >
              <ExternalLink size={16} aria-hidden="true" />
              <span>Sobre el proyecto</span>
            </a>
          </DropdownMenu.Item>
        </div>

        <DropdownMenu.Separator className="h-px bg-[#262626]" />
        <div className="py-1">
          <DropdownMenu.Item
            className={SIGN_OUT_CLASS}
            disabled={isSigningOut}
            onSelect={onSignOut}
          >
            <GmaIcon name="close" size={16} />
            <span>{isSigningOut ? "Saliendo…" : isGuest ? "Salir al inicio" : "Cerrar sesión"}</span>
          </DropdownMenu.Item>
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}
