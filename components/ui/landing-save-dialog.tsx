"use client";

import { GmaIcon } from "@/components/ui/gma-icon";
import { LoginRequiredDialog } from "@/components/ui/login-required-dialog";
import { PosterArt } from "@/components/ui/poster-art";
import type { MovieMedia } from "@/types/catalog";

interface LandingSaveDialogProps {
  /** La obra que se quería guardar; `null` = cerrado. */
  readonly item: MovieMedia | null;
  readonly onClose: () => void;
  /** Lleva a la pasarela de inicio de sesión. */
  readonly onLogin: () => void;
}

const PERKS = [
  "Guarda lo que quieres ver en Mi lista",
  "Retoma cada obra justo donde la dejaste",
  "Valora y comenta los cortos y películas",
] as const;

/** «Inicia sesión para guardar» al pulsar el icono de guardar en la bienvenida: ver `LoginRequiredDialog`. */
export function LandingSaveDialog({ item, onClose, onLogin }: LandingSaveDialogProps) {
  return (
    <LoginRequiredDialog
      open={item !== null}
      onClose={onClose}
      onLogin={onLogin}
      title={item ? `Guarda «${item.title}» y mucho más` : ""}
      description="Para guardar este título en tu lista necesitas iniciar sesión. Es gratis y lleva un minuto."
      perks={PERKS}
      badge={<GmaIcon name="bookmark" size={28} strokeWidth={2} />}
      media={item ? <PosterArt fill style={item.style} title={item.title} kind={item.kind} ratio="landscape" imageUrl={item.imageUrl} /> : null}
    />
  );
}
