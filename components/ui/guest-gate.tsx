"use client";

import { useIsGuest } from "@/hooks/use-is-guest";
import { useRouter } from "next/navigation";

interface GuestGateProps {
  readonly children: React.ReactNode;
  readonly message?: string;
}

export function GuestGate({
  children,
  message = "Para acceder a esta sección, inicia sesión o regístrate.",
}: GuestGateProps) {
  const isGuest = useIsGuest();
  const router  = useRouter();

  if (!isGuest) return <>{children}</>;

  return (
    <div className="relative overflow-hidden rounded-[14px]">
      <div aria-hidden="true" className="pointer-events-none select-none opacity-20 blur-[3px]">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#060A10]/80 px-8 backdrop-blur-sm">
        <div className="text-center">
          <p className="mb-1.5 text-[18px] font-extrabold text-white">Necesitas una cuenta</p>
          <p className="text-[14px] text-[#B8C5D4]">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full bg-[#22B16B] px-7 py-2.5 text-[14px] font-bold text-[#031A0E] transition-colors hover:bg-[#2AC57A]"
        >
          Iniciar sesión o registrarse
        </button>
      </div>
    </div>
  );
}
