import type { CreatorProfile } from "@/types/creator";
import { externalUrl } from "@/lib/social-links";

export interface SupportMethod { key: "paypal" | "patreon" | "bitcoin"; label: string; href: string; address?: string }
export function supportPath(slug: string): string { return `/creadores/${encodeURIComponent(slug)}/apoyar`; }
/** Enlace de PayPal válido (paypal.me/usuario, paypal.com/paypalme/usuario o un botón de donación), o `null`. */
export function paypalHref(raw: string | null | undefined): string | null {
  const paypal = externalUrl(raw);
  if (!paypal) return null;
  const url = new URL(paypal);
  const host = url.hostname.toLowerCase();
  const isPaypalMe = host === "paypal.me" && /^\/[^/]+\/?$/.test(url.pathname);
  const isPaypalCom = host === "paypal.com" || host === "www.paypal.com";
  const isPaypalMePath = isPaypalCom && /^\/paypalme\/[^/]+\/?$/.test(url.pathname);
  const isDonateButton = isPaypalCom && /^\/donate\/?$/.test(url.pathname) && Boolean(url.searchParams.get("hosted_button_id") || url.searchParams.get("business"));
  return url.protocol === "https:" && (isPaypalMe || isPaypalMePath || isDonateButton) ? paypal : null;
}

/** Enlace a la página de un creador en Patreon, o `null`. */
export function patreonHref(raw: string | null | undefined): string | null {
  const patreon = externalUrl(raw);
  if (!patreon) return null;
  const url = new URL(patreon);
  const parts = url.pathname.split("/").filter(Boolean);
  const name = parts[0];
  const reserved = ["login", "signup", "settings", "explore", "home", "checkout", "oauth2"];
  const isPatreon = ["patreon.com", "www.patreon.com"].includes(url.hostname.toLowerCase());
  return url.protocol === "https:" && isPatreon && name && !reserved.includes(name) && (name !== "c" || Boolean(parts[1])) ? patreon : null;
}

/** Dirección de recepción de Bitcoin (mainnet, sin importes ni parámetros), o `null`. */
export function bitcoinAddress(raw: string | null | undefined): string | null {
  const address = raw?.trim().replace(/^bitcoin:/i, "") ?? "";
  return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || /^bc1[ac-hj-np-z02-9]{11,87}$/.test(address) ? address : null;
}

const SUPPORT_LABELS: Record<SupportMethod["key"], string> = { paypal: "PayPal", patreon: "Patreon", bitcoin: "Bitcoin" };

/** Motivo por el que un valor escrito en Mi Estudio no sirve como método de apoyo; `null` si está vacío o es válido. */
export function supportLinkProblem(key: SupportMethod["key"], raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const valid = key === "paypal" ? paypalHref(raw) : key === "patreon" ? patreonHref(raw) : bitcoinAddress(raw);
  return valid ? null : `Revisa el dato de ${SUPPORT_LABELS[key]}: no es un enlace o una dirección válidos.`;
}

export function supportMethods(creator: CreatorProfile | null): SupportMethod[] {
  if (!creator) return [];
  const methods: SupportMethod[] = [];
  const paypal = paypalHref(creator.donacion_paypal);
  if (paypal) methods.push({ key: "paypal", label: "Donar por PayPal", href: paypal });
  const patreon = patreonHref(creator.donacion_patreon);
  if (patreon) methods.push({ key: "patreon", label: "Apoyar en Patreon", href: patreon });
  const address = bitcoinAddress(creator.donacion_bitcoin);
  if (address) methods.push({ key: "bitcoin", label: "Apoyar con Bitcoin", href: `bitcoin:${address}`, address });
  return methods;
}
