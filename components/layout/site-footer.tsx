import Image from "next/image";
import Link from "next/link";
import { siInstagram, siTiktok, siX, siYoutube } from "simple-icons";
import { RevealFooter } from "@/components/layout/reveal-footer";
import { getSiteSocials, type SiteSocialKey } from "@/lib/site-links";

interface FooterLink {
  readonly label: string;
  readonly href: string;
  /** Enlace a otra web: se abre en pestaña nueva. */
  readonly isExternal?: boolean;
}

interface FooterGroup {
  readonly title: string;
  readonly links: readonly FooterLink[];
}

const GROUPS: readonly FooterGroup[] = [
  {
    title: "Explorar",
    links: [
      { label: "Inicio", href: "/inicio" },
      { label: "Películas", href: "/peliculas" },
      { label: "Cortos", href: "/cortos" },
      { label: "Buscador", href: "/buscador" },
    ],
  },
  {
    title: "Proyecto",
    links: [
      { label: "Sobre el proyecto", href: "https://generacionmaldita.com/sobre-el-proyecto/", isExternal: true },
      { label: "Generación Maldita", href: "https://generacionmaldita.com", isExternal: true },
      { label: "Mi Espacio", href: "/mi-espacio" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Términos de uso", href: "/terminos" },
      { label: "Política de privacidad", href: "/privacidad" },
    ],
  },
];

const SOCIAL_ICON_PATHS: Record<SiteSocialKey, string> = {
  x: siX.path,
  instagram: siInstagram.path,
  tiktok: siTiktok.path,
  youtube: siYoutube.path,
};

const LINK_CLASS =
  "rounded-[3px] text-[13px] text-[#949494] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

function SocialIcon({ path }: { path: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/**
 * Pie de página sencillo: marca, enlaces útiles, legal y redes oficiales. Va al final de todas las secciones.
 * El contenido es de servidor; solo el envoltorio (`RevealFooter`) es de cliente, para el efecto de cortina. Lleva su
 * propia capa (`z-10`) y fondo sólido: Inicio y Buscador pintan un fondo fijo a pantalla completa (z-0) que, sin esto,
 * quedaba por encima del pie y lo tapaba.
 */
interface SiteFooterProps {
  /** Espacio extra bajo el pie (zona segura y barra inferior móvil). */
  readonly insetClassName?: string;
}

export function SiteFooter({ insetClassName }: SiteFooterProps) {
  const socials = getSiteSocials();
  const year = new Date().getFullYear();

  return (
    <RevealFooter innerClassName={insetClassName}>
      <footer className="border-t border-white/10 px-4 pb-8 pt-10 sm:px-8 lg:px-16">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-[320px]">
            <Link
              href="/inicio"
              aria-label="GMA Filmo, ir al inicio"
              className="inline-block rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <Image src="/images/logo-gma.png" alt="" width={112} height={36} style={{ height: 32, width: "auto" }} />
            </Link>
            <p className="mt-3 text-[13px] leading-[1.6] text-[#949494]">
              Cortos, animación y nuevas voces del cine independiente. Una plataforma gratuita y sin publicidad del
              colectivo Generación Maldita.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3 lg:gap-x-16">
            {GROUPS.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#C4C4C4]">{group.title}</h2>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {link.isExternal ? (
                        <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                          {link.label}
                          <span className="sr-only"> (se abre en una pestaña nueva)</span>
                        </a>
                      ) : (
                        <Link href={link.href} className={LINK_CLASS}>
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-[#7A7A7A]">© {year} GMA Filmo · Generación Maldita</p>
          <ul aria-label="Redes sociales" className="flex items-center gap-1">
            {socials.map((social) => (
              <li key={social.key}>
                {social.href ? (
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`GMA en ${social.label} (se abre en una pestaña nueva)`}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-[#949494] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <SocialIcon path={SOCIAL_ICON_PATHS[social.key]} />
                  </a>
                ) : (
                  // Sin cuenta todavía: icono apagado, sin enlace y fuera del tabulador.
                  <span className="flex h-11 w-11 cursor-default items-center justify-center rounded-full text-[#949494] opacity-40">
                    <SocialIcon path={SOCIAL_ICON_PATHS[social.key]} />
                    <span className="sr-only">{social.label} (próximamente)</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </RevealFooter>
  );
}
