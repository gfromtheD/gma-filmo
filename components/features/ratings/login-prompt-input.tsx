"use client";

import Link from "next/link";

/**
 * Aviso para visitantes en Valoraciones y Comentarios: una invitación clara (mensaje, una línea de explicación y un
 * botón verde, sin icono), en el mismo cristal oscuro que el resto de tarjetas de la ficha.
 */
export function LoginPromptInput() {
  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-white/10 bg-black/40 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <p className="break-words text-[16px] font-bold leading-snug text-white">Inicia sesión para comentar</p>
        <p className="mt-0.5 break-words text-[14px] leading-snug text-[#BBBBBB]">Valora y comenta con tu perfil.</p>
      </div>
      <Link
        href="/?login=1"
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-[4px] bg-[#22B16B] px-5 text-[14px] font-extrabold uppercase text-[#031A0E] transition-colors hover:bg-[#2AC57A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Iniciar sesión
      </Link>
    </div>
  );
}
