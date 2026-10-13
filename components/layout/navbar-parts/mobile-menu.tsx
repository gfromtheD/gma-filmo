"use client";

import Link from "next/link";
import { Dialog } from "radix-ui";
import { Menu, Xmark as X } from "@/components/ui/icons";

export interface MobileMenuItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly isActive: boolean;
}

interface MobileMenuProps {
  readonly items: readonly MobileMenuItem[];
  /** Visitante: el panel ofrece registrarse e iniciar sesión (la cabecera móvil solo muestra el botón de registro). */
  readonly isGuest?: boolean;
}

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * Panel lateral de navegación para anchos < lg. Radix Dialog aporta foco
 * atrapado, Escape, aria-modal y devolución del foco al botón.
 */
export function MobileMenu({ items, isGuest = false }: MobileMenuProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Abrir menú principal"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white lg:hidden ${FOCUS_RING}`}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[300] lg:hidden bg-black/70 backdrop-blur-sm duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-[301] flex lg:hidden w-[min(86vw,288px)] flex-col border-r border-[#262626] bg-[#0D0D0D] shadow-2xl outline-none duration-200 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left motion-reduce:animate-none"
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#262626] pl-5 pr-3">
            <Dialog.Title className="text-[14px] font-extrabold text-white">
              Menú principal
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar menú"
                className={`flex h-11 w-11 items-center justify-center rounded-full text-[#B8C5D4] transition-colors hover:bg-[#1A1A1A] hover:text-white ${FOCUS_RING}`}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {isGuest && (
            <div className="flex flex-col gap-3 px-4 pt-4">
              <Dialog.Close asChild>
                <Link
                  href="/?register=1"
                  className={`flex h-10 items-center justify-center rounded-[4px] bg-[#22B16B] text-[16px] font-extrabold uppercase text-[#031A0E] transition-colors hover:bg-[#2AC57A] ${FOCUS_RING}`}
                >
                  Registrarse
                </Link>
              </Dialog.Close>
              <Dialog.Close asChild>
                <Link
                  href="/?login=1"
                  className={`flex h-10 items-center justify-center rounded-[4px] text-[16px] font-extrabold uppercase text-white transition-colors hover:text-[#22B16B] ${FOCUS_RING}`}
                >
                  Iniciar sesión
                </Link>
              </Dialog.Close>
            </div>
          )}

          <nav aria-label="Secciones" className="flex flex-col overflow-y-auto px-4 pt-3">
            {items.map((item) => (
              <Dialog.Close asChild key={item.id}>
                <Link
                  href={item.href}
                  aria-current={item.isActive ? "page" : undefined}
                  className={`flex h-14 items-center border-b border-[#1C1C2C] text-[16px] text-white transition-colors hover:text-[#22B16B] aria-[current=page]:font-bold aria-[current=page]:text-[#22B16B] ${FOCUS_RING}`}
                >
                  {item.label}
                </Link>
              </Dialog.Close>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
