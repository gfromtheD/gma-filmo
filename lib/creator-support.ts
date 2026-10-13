import type { CreatorProfile } from "@/types/creator";
import { externalUrl } from "@/lib/social-links";

export interface SupportMethod { key: "paypal" | "patreon" | "bitcoin"; label: string; href: string; address?: string }
export function supportPath(slug: string): string { return `/creadores/${encodeURIComponent(slug)}/apoyar`; }
export function supportMethods(creator: CreatorProfile | null): SupportMethod[] {
  if (!creator) return [];
  const methods: SupportMethod[] = [];
  const paypal = externalUrl(creator.donacion_paypal);
  if (paypal) {
    const url = new URL(paypal); const host = url.hostname.toLowerCase();
    if (url.protocol === "https:" && ((host === "paypal.me" && /^\/[^/]+\/?$/.test(url.pathname)) ||
      ((host === "paypal.com" || host === "www.paypal.com") &&
        (/^\/paypalme\/[^/]+\/?$/.test(url.pathname) || (/^\/donate\/?$/.test(url.pathname) && Boolean(url.searchParams.get("hosted_button_id") || url.searchParams.get("business"))))))) {
      methods.push({ key: "paypal", label: "Donar por PayPal", href: paypal });
    }
  }
  const patreon = externalUrl(creator.donacion_patreon);
  if (patreon) {
    const url = new URL(patreon); const name = url.pathname.split("/").filter(Boolean)[0];
    if (url.protocol === "https:" && ["patreon.com", "www.patreon.com"].includes(url.hostname.toLowerCase()) && name &&
      !["login", "signup", "settings", "explore", "home", "checkout", "oauth2"].includes(name) && (name !== "c" || url.pathname.split("/").filter(Boolean)[1])) {
      methods.push({ key: "patreon", label: "Apoyar en Patreon", href: patreon });
    }
  }
  const address = creator.donacion_bitcoin?.trim().replace(/^bitcoin:/i, "") ?? "";
  // Only a mainnet receiving address, without amounts or untrusted URI parameters.
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || /^bc1[ac-hj-np-z02-9]{11,87}$/.test(address)) {
    methods.push({ key: "bitcoin", label: "Apoyar con Bitcoin", href: `bitcoin:${address}`, address });
  }
  return methods;
}
