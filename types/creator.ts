export interface SocialLink {
  readonly platform: string;
  readonly url: string;
}

export interface CreatorProfile {
  readonly editorial?: boolean;
  readonly source_url?: string | null;
  readonly slug: string;
  readonly nombre: string;
  readonly foto_perfil: string | null;
  readonly imagen_portada: string | null;
  readonly nacionalidad: string | null;
  readonly bio: string | null;
  readonly redes_sociales: readonly SocialLink[];
  readonly donacion_paypal: string | null;
  readonly donacion_patreon: string | null;
  readonly donacion_bitcoin: string | null;
  readonly titulos: readonly string[];
  /** Perfil llevado por el equipo de GMA en nombre del autor: la página invita a reclamarlo. */
  readonly gestionado?: boolean;
}
