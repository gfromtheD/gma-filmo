"use client";

import { useRouter } from "next/navigation";
import { GmaIcon } from "@/components/ui/gma-icon";

export function LoginPromptInput() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/")}
      className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-[12px] border border-[#262626] bg-[#0D0D0D] px-3 py-3 sm:px-5 sm:py-4 text-left text-[14px] text-[#6D7D94] transition-colors hover:border-[#3A3A3A]"
    >
      <GmaIcon name="star" size={16} strokeWidth={2} className="shrink-0 text-[#4A5568]" />
      <span className="min-w-0 break-words">Inicia sesión para comentar</span>
    </button>
  );
}
