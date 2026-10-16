/**
 * Secciones de texto de la cabecera de escritorio. «Mi Espacio» no está aquí: se abre desde el icono de guardados, junto
 * a la foto de perfil. «Mi Estudio» solo lo ven los creadores y es un enlace normal (sin doble clic ni ruleta).
 */
export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly match: string;
}

const BASE_ITEMS: readonly NavItem[] = [
  { id: "home", label: "Home", href: "/inicio", match: "/inicio" },
  { id: "movies", label: "Películas", href: "/peliculas", match: "/peliculas" },
  { id: "cortos", label: "Cortos", href: "/cortos", match: "/cortos" },
];

const STUDIO_ITEM: NavItem = { id: "studio", label: "Mi Estudio", href: "/mi-estudio", match: "/mi-estudio" };

export function getNavItems(isCreator: boolean): readonly NavItem[] {
  return isCreator ? [...BASE_ITEMS, STUDIO_ITEM] : BASE_ITEMS;
}
