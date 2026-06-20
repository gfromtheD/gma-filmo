"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { DashboardView } from "./studio-dashboard-view";
import { TitlesView }    from "./studio-titles-view";
import { UploadView }    from "./studio-upload-view";
import { StatsView }     from "./studio-stats-view";
import { ProfileView }   from "./studio-profile-view";
import { EditModal }     from "./studio-edit-modal";
import { C }             from "./studio-ui";
import { STUDIO_DATA }   from "./studio-data";
import { useStudioTabStore } from "@/store/use-studio-tab-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { StudioTitle, StudioTabId } from "./studio-types";
export type { StudioTabId };

export function StudioScreen() {
  const { activeTab: active, setActiveTab } = useStudioTabStore();
  const [editTitle,  setEditTitle]  = useState<StudioTitle | null>(null);
  const [openTitle,  setOpenTitle]  = useState<StudioTitle | null>(null);
  const [focusTitle, setFocusTitle] = useState<StudioTitle | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; error?: boolean; key: number } | null>(null);
  const [data,       setData]       = useState(STUDIO_DATA);
  const [titlesVersion, setTitlesVersion] = useState(0);

  // Fetch creator profile
  useEffect(() => {
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: row } = await supabase
        .from("creator_profiles")
        .select("creator_name, studio_name, bio, location, website_url, role, instagram_url, vimeo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!row) return;

      setData((d) => ({
        ...d,
        creator: {
          ...d.creator,
          studioName: row.studio_name ?? d.creator.studioName,
          artistName: row.creator_name ?? d.creator.artistName,
          bio:        row.bio ?? d.creator.bio,
          location:   row.location ?? d.creator.location,
          role:       row.role ?? d.creator.role,
          socials: {
            ...d.creator.socials,
            web:       row.website_url   ?? d.creator.socials.web,
            instagram: row.instagram_url ? `@${row.instagram_url}` : d.creator.socials.instagram,
            vimeo:     row.vimeo_url     ? `vimeo.com/${row.vimeo_url}` : d.creator.socials.vimeo,
          },
        },
      }));
    })();
  }, []);

  // Fetch real titles uploaded by this creator
  useEffect(() => {
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows, error } = await (supabase as any)
          .from("peliculas")
          .select("id, slug, title, synopsis, year, duration, genre, language, r2_poster_url, created_at")
          .eq("creator_user_id", user.id)
          .order("created_at", { ascending: false });

        if (error || !rows) return;

        const realTitles: StudioTitle[] = (rows as Record<string, unknown>[]).map((row) => ({
          id:          row.slug as string,
          title:       row.title as string,
          type:        row.genre === "Película" ? "Película" : "Cortometraje",
          genre:       (row.genre as string | null) ?? "Cortometraje",
          year:        parseInt((row.year as string | null) ?? "0") || new Date().getFullYear(),
          duration:    (row.duration as string | null) ?? "",
          status:      "publicado" as const,
          description: (row.synopsis as string | null) ?? "",
          language:    (row.language as string | null) ?? "Español",
          subtitles:   [],
          poster:      { from: "#1c2a38", to: "#0a1119", accent: "#3fae7e" },
          r2PosterUrl: (row.r2_poster_url as string | null) ?? undefined,
          publishDate: new Date(row.created_at as string).toLocaleDateString("es-ES"),
          views:       0,
        }));

        setData((d) => ({ ...d, titles: realTitles }));
      } catch {
        // Column creator_user_id may not exist yet (migration pending) — keep mock data
      }
    })();
  }, [titlesVersion]);

  const handlePublished = useCallback(() => {
    setTitlesVersion((v) => v + 1);
  }, []);

  const handleDelete = useCallback(async (t: StudioTitle) => {
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { showToast("No autenticado", { error: true }); return; }

    try {
      const res = await fetch(`/api/titles/${encodeURIComponent(t.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast((body as { error?: string }).error ?? "Error al eliminar", { error: true });
        return;
      }
      setData((d) => ({ ...d, titles: d.titles.filter((x) => x.id !== t.id) }));
      showToast(`«${t.title}» eliminado`);
    } catch {
      showToast("Error de red al eliminar", { error: true });
    }
  }, []);

  function showToast(msg: string, opts?: { error?: boolean }) {
    setToast({ msg, error: opts?.error, key: Date.now() });
    setTimeout(() => setToast(null), 3200);
  }

  function nav(id: StudioTabId, payload?: StudioTitle) {
    if (id === "estadisticas" && payload) setFocusTitle(payload);
    setActiveTab(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openTitleAndGoToTitles(t: StudioTitle) {
    setActiveTab("titulos");
    setTimeout(() => setOpenTitle(t), 60);
  }

  return (
    <div style={{ animation: "fadeIn 0.55s ease both" }}>
      {/* View content */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "72px 28px 80px" }}>
        {active === "inicio" && (
          <DashboardView data={data} onNav={nav} onOpenTitle={openTitleAndGoToTitles} />
        )}
        {active === "titulos" && (
          <TitlesView data={data} onNav={nav} onEditTitle={setEditTitle}
            onToast={showToast} onDelete={handleDelete} openTitle={openTitle} setOpenTitle={setOpenTitle} />
        )}
        {active === "subir" && (
          <UploadView data={data} onToast={showToast} onNav={nav} onPublished={handlePublished} />
        )}
        {active === "estadisticas" && (
          <StatsView data={data} onToast={showToast} focusTitle={focusTitle} />
        )}
        {active === "perfil" && (
          <ProfileView data={data} onToast={showToast} />
        )}
      </div>

      {/* Edit modal */}
      <EditModal title={editTitle} onClose={() => setEditTitle(null)} onToast={showToast} data={data} />

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 200, pointerEvents: "none" }}>
          <div key={toast.key} style={{
            display: "flex", alignItems: "center", gap: 11, animation: "dropIn 0.16s ease both",
            background: "#101820", border: `1px solid ${C.border2}`, borderRadius: 12,
            padding: "13px 18px", boxShadow: "0 18px 44px -12px rgba(0,0,0,0.7)", maxWidth: 440,
          }}>
            <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 999,
              background: toast.error ? "rgba(255,82,82,0.14)" : C.accent15,
              color: toast.error ? C.errorFg : C.accentH }}>
              {toast.error ? <AlertTriangle size={15} strokeWidth={2.4} /> : <Check size={15} strokeWidth={2.4} />}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#fff" }}>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
