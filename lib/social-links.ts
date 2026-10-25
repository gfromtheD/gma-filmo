const SOCIAL_HOSTS: Record<string, string[]> = {
  instagram: ["instagram.com"], tiktok: ["tiktok.com"], youtube: ["youtube.com", "youtu.be"],
  x: ["x.com", "twitter.com"], threads: ["threads.net", "threads.com"],
  facebook: ["facebook.com", "fb.com"], vimeo: ["vimeo.com"],
  letterboxd: ["letterboxd.com", "boxd.it"], imdb: ["imdb.com", "m.imdb.com"],
};
const SOCIAL_PREFIXES: Record<string, string> = {
  instagram: "https://instagram.com/", tiktok: "https://tiktok.com/@",
  youtube: "https://youtube.com/@", x: "https://x.com/",
  threads: "https://threads.net/@", facebook: "https://facebook.com/", vimeo: "https://vimeo.com/",
  letterboxd: "https://letterboxd.com/", imdb: "https://www.imdb.com/name/",
};
/** En IMDb no hay «usuario»: la ficha de una persona se identifica por su código (nm + cifras). */
const HANDLE_PATTERN: Record<string, RegExp> = { imdb: /^nm\d{5,}$/i };
const HANDLE_SUFFIX: Record<string, string> = { imdb: "/" };

export function externalUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const text = value.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) && !/^https?:\/\//i.test(text)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (!url.hostname.includes(".") || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}

export function socialUrl(platform: string, value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  if (platform === "website") return externalUrl(text);
  const hosts = Object.prototype.hasOwnProperty.call(SOCIAL_HOSTS, platform) ? SOCIAL_HOSTS[platform] : undefined;
  if (!hosts) return externalUrl(text);
  const isUrl = /^https?:\/\//i.test(text) || /^(?:www\.)?[^/\s]+\.[^/\s]+\//.test(text);
  if (isUrl) {
    const href = externalUrl(text);
    if (!href) return null;
    const host = new URL(href).hostname.toLowerCase().replace(/^www\./, "");
    return hosts.includes(host) ? href : null;
  }
  // A handle must not be interpreted as another host, URL or executable scheme.
  const handle = text.replace(/^@/, "");
  if (!handle || /[\s/:?#\\]/.test(handle)) return null;
  if (HANDLE_PATTERN[platform] && !HANDLE_PATTERN[platform].test(handle)) return null;
  return `${SOCIAL_PREFIXES[platform]}${encodeURIComponent(handle)}${HANDLE_SUFFIX[platform] ?? ""}`;
}
