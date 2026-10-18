import { notificationText, starsToTen } from "@/lib/notifications/rules";

/**
 * Descarga de datos del usuario (Configuración → «Tus datos»): da forma legible a lo que guarda la base de datos
 * (obras con su título, no con su número interno) y lo pinta como una página HTML sencilla. Módulo puro.
 */

export interface FilmRef { readonly id: number; readonly slug: string; readonly title: string; readonly year: number | null }

/** Filas tal como salen de la base de datos. */
export interface RawExport {
  readonly exportedAt: string;
  readonly account: { readonly id: string; readonly email: string | null; readonly createdAt: string | null };
  readonly profile: Record<string, unknown> | null;
  readonly creatorProfile: Record<string, unknown> | null;
  readonly watchlist: readonly { profile_id: string; pelicula_id: number; added_at: string }[];
  readonly ratings: readonly { profile_id: string; pelicula_id: number; score: number; comment: string; rated_at: string }[];
  readonly history: readonly { profile_id: string; pelicula_id: number; last_position: number; completed: boolean; last_watched_at: string }[];
  readonly comments: readonly { id: number; pelicula_id: number; parent_id: number | null; content: string; created_at: string; is_deleted: boolean }[];
  readonly lists: readonly { id: string; profile_id: string; name: string; created_at: string; user_list_items: { pelicula_id: number; added_at: string }[] }[];
  readonly notifications: readonly { kind: "rating"; pelicula_id: number; score: number | null; created_at: string; read_at: string | null }[];
}

interface Titled { readonly title: string; readonly year: number | null; readonly slug: string | null }

export interface UserExport {
  readonly exportedAt: string;
  readonly account: RawExport["account"];
  readonly profile: RawExport["profile"];
  readonly creatorProfile: RawExport["creatorProfile"];
  readonly saved: readonly (Titled & { addedAt: string })[];
  /** `score` va del 1 al 10, como en la app. */
  readonly ratings: readonly (Titled & { score: number; comment: string; ratedAt: string })[];
  readonly history: readonly (Titled & { watchedSeconds: number; finished: boolean; lastWatchedAt: string })[];
  readonly comments: readonly (Titled & { content: string; isReply: boolean; createdAt: string })[];
  readonly lists: readonly { name: string; createdAt: string; items: readonly (Titled & { addedAt: string })[] }[];
  readonly notifications: readonly (Titled & { text: string; createdAt: string })[];
}

const REMOVED_TITLE = "Obra retirada";

export function buildUserExport(raw: RawExport, films: readonly FilmRef[]): UserExport {
  const byId = new Map(films.map((f) => [f.id, f]));
  const titled = (id: number): Titled => {
    const film = byId.get(id);
    return film ? { title: film.title, year: film.year, slug: film.slug } : { title: REMOVED_TITLE, year: null, slug: null };
  };
  return {
    exportedAt: raw.exportedAt,
    account: raw.account,
    profile: raw.profile,
    creatorProfile: raw.creatorProfile,
    saved: raw.watchlist.map((r) => ({ ...titled(r.pelicula_id), addedAt: r.added_at })),
    ratings: raw.ratings.map((r) => ({ ...titled(r.pelicula_id), score: starsToTen(r.score), comment: r.comment, ratedAt: r.rated_at })),
    history: raw.history.map((r) => ({ ...titled(r.pelicula_id), watchedSeconds: Math.round(r.last_position), finished: r.completed, lastWatchedAt: r.last_watched_at })),
    comments: raw.comments.filter((c) => !c.is_deleted).map((c) => ({ ...titled(c.pelicula_id), content: c.content, isReply: c.parent_id !== null, createdAt: c.created_at })),
    lists: raw.lists.map((l) => ({
      name: l.name, createdAt: l.created_at,
      items: l.user_list_items.map((i) => ({ ...titled(i.pelicula_id), addedAt: i.added_at })),
    })),
    notifications: raw.notifications.map((n) => {
      const film = titled(n.pelicula_id);
      return { ...film, text: notificationText({ kind: n.kind, score: n.score, title: film.title }), createdAt: n.created_at };
    }),
  };
}

// ── HTML ────────────────────────────────────────────────────────────────────────

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const date = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

function minutes(seconds: number): string {
  if (seconds < 60) return "menos de 1 min";
  const total = Math.round(seconds / 60);
  return total < 60 ? `${total} min` : `${Math.floor(total / 60)} h ${total % 60} min`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const nameOf = (item: Titled) => `<strong>${escapeHtml(item.title)}</strong>${item.year ? ` <span class="muted">${item.year}</span>` : ""}`;

function section(title: string, rows: readonly string[]): string {
  if (rows.length === 0) return "";
  return `<section><h2>${escapeHtml(title)}</h2><ul>${rows.map((r) => `<li>${r}</li>`).join("")}</ul></section>`;
}

const STYLES = `
:root { color-scheme: dark light; --bg:#0b0f0d; --text:#e8ece9; --muted:#8a9690; --line:rgba(255,255,255,.09); --accent:#2ac57a; }
@media (prefers-color-scheme: light) { :root { --bg:#fafbfa; --text:#16201b; --muted:#66726c; --line:rgba(0,0,0,.1); --accent:#168650; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width:720px; margin:0 auto; padding:48px 20px 80px; }
h1 { margin:0; font-size:30px; letter-spacing:-.01em; }
.lead { margin:6px 0 0; color:var(--muted); }
.summary { display:flex; flex-wrap:wrap; gap:8px 22px; margin:24px 0 8px; padding:16px 0; border-block:1px solid var(--line); }
.summary b { color:var(--accent); font-variant-numeric:tabular-nums; }
section { margin-top:36px; }
h2 { margin:0 0 8px; font-size:18px; }
ul { margin:0; padding:0; list-style:none; }
li { padding:10px 0; border-top:1px solid var(--line); }
li:first-child { border-top:0; }
.muted { color:var(--muted); font-size:14px; }
.quote { margin:4px 0 0; color:var(--muted); font-style:italic; }
.score { color:var(--accent); font-weight:600; font-variant-numeric:tabular-nums; }
footer { margin-top:48px; color:var(--muted); font-size:13px; }
`;

/** Página HTML autocontenida (se abre con doble clic en cualquier navegador, sin conexión). */
export function renderExportHtml(data: UserExport): string {
  const who = (data.profile?.display_name as string | undefined)?.trim() || data.account.email || "tu cuenta";
  const summary = [
    plural(data.saved.length, "guardada", "guardadas"),
    plural(data.ratings.length, "valoración", "valoraciones"),
    plural(data.lists.length, "lista", "listas"),
    plural(data.comments.length, "comentario", "comentarios"),
    plural(data.history.length, "obra vista", "obras vistas"),
  ].map((text) => { const [n, ...rest] = text.split(" "); return `<span><b>${n}</b> ${escapeHtml(rest.join(" "))}</span>`; }).join("");

  const creator = data.creatorProfile;
  const creatorRows = creator
    ? [["Estudio", creator.studio_name], ["Nombre artístico", creator.creator_name], ["Rol", creator.role], ["Ubicación", creator.location], ["Biografía", creator.bio]]
        .filter(([, value]) => typeof value === "string" && value.trim())
        .map(([label, value]) => `<span class="muted">${label}</span><br>${escapeHtml(String(value))}`)
    : [];

  const body = [
    section("Tu ficha de creador", creatorRows),
    section("Guardadas", data.saved.map((s) => `${nameOf(s)}<br><span class="muted">Guardada el ${date(s.addedAt)}</span>`)),
    section("Tus listas", data.lists.map((l) =>
      `<strong>${escapeHtml(l.name)}</strong> <span class="muted">· ${plural(l.items.length, "obra", "obras")}</span>` +
      (l.items.length ? `<br><span class="muted">${l.items.map((i) => escapeHtml(i.title)).join(", ")}</span>` : ""))),
    section("Valoraciones", data.ratings.map((r) =>
      `${nameOf(r)} <span class="score">${r.score}/10</span><br><span class="muted">${date(r.ratedAt)}</span>` +
      (r.comment.trim() ? `<p class="quote">«${escapeHtml(r.comment.trim())}»</p>` : ""))),
    section("Comentarios", data.comments.map((c) =>
      `${nameOf(c)}${c.isReply ? ' <span class="muted">· respuesta</span>' : ""}<p class="quote">«${escapeHtml(c.content)}»</p><span class="muted">${date(c.createdAt)}</span>`)),
    section("Historial", data.history.map((h) =>
      `${nameOf(h)}<br><span class="muted">${h.finished ? "Terminada" : `Vista hasta el minuto ${Math.floor(h.watchedSeconds / 60)} (${minutes(h.watchedSeconds)})`} · ${date(h.lastWatchedAt)}</span>`)),
    section("Avisos", data.notifications.map((n) => `${escapeHtml(n.text)}<br><span class="muted">${date(n.createdAt)}</span>`)),
  ].join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mis datos · GMA Filmo</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<h1>Tus datos en GMA Filmo</h1>
<p class="lead">Copia de ${escapeHtml(who)} · ${date(data.exportedAt)}</p>
<div class="summary">${summary}</div>
${body}
<footer>Cuenta: ${escapeHtml(data.account.email ?? "—")}${data.account.createdAt ? ` · creada el ${date(data.account.createdAt)}` : ""}. Si prefieres los datos en formato técnico, descarga también la versión JSON desde Configuración.</footer>
</main>
</body>
</html>
`;
}
