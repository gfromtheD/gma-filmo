"use client";

import styles from "./studio-responsive.module.css";

import { useState, useEffect, useCallback } from "react";
import { Check, WarningTriangle as AlertTriangle } from "@/components/ui/icons";
import { DashboardView } from "./studio-dashboard-view";
import { TitlesView }    from "./studio-titles-view";
import { UploadWizard }  from "./upload/upload-wizard";
import { StudioSidebar } from "./studio-sidebar";
import { ProfileView }   from "./studio-profile-view";
import { EditModal }     from "./studio-edit-modal";
import { C }             from "./studio-ui";
import { STUDIO_DATA }   from "./studio-data";
import { useStudioTabStore } from "@/store/use-studio-tab-store";
import { useAuth } from "@/components/providers/supabase-auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { StudioTitle, StudioTabId } from "./studio-types";
export type { StudioTabId };

// Las columnas de la migración de subidas aún no figuran en los tipos generados.
interface StudioTitleRow {
  slug: string; title: string; synopsis: string | null; year: string | null;
  duration: string | null; genre: string | null; language: string | null;
  r2_poster_url: string | null; created_at: string | null; status: string | null; file_size_bytes: number | null;
}

export function StudioScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id;
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const { activeTab: active, setActiveTab } = useStudioTabStore();
  const [editTitle,  setEditTitle]  = useState<StudioTitle | null>(null);
  const [openTitle,  setOpenTitle]  = useState<StudioTitle | null>(null);
  const [focusTitle, setFocusTitle] = useState<StudioTitle | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; error?: boolean; key: number } | null>(null);
  const [data,       setData]       = useState(STUDIO_DATA);
  const [titlesVersion, setTitlesVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadedUserId(null);
    setLoadError("");
    setData(STUDIO_DATA);
    if (!userId) return;

    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const [profileResult, titlesResult] = await Promise.all([
          supabase.from("creator_profiles")
            .select("creator_name, studio_name, bio, location, role, avatar_url, social_links")
            .eq("user_id", userId).maybeSingle(),
          supabase.from("peliculas")
            .select("slug, title, synopsis, year, duration, genre, language, r2_poster_url, created_at, status, file_size_bytes")
            .eq("creator_user_id", userId).order("created_at", { ascending: false }).returns<StudioTitleRow[]>(),
        ]);
        if (profileResult.error || titlesResult.error || !profileResult.data) {
          throw new Error("No se pudo cargar el estudio");
        }
        const profile = profileResult.data;
        const realTitles: StudioTitle[] = (titlesResult.data ?? []).map((row) => ({
          id: row.slug, title: row.title,
          type: row.genre === "Película" ? "Película" : "Cortometraje",
          genre: row.genre ?? "Cortometraje",
          year: parseInt(row.year ?? "0") || new Date().getFullYear(),
          duration: row.duration ?? "",
          status: row.status === "published" ? "publicado" : row.status === "draft" ? "borrador"
            : row.status === "review" ? "revision" : row.status === "rejected" ? "rechazado" : "borrador",
          description: row.synopsis ?? "", language: row.language ?? "",
          subtitles: [], poster: STUDIO_DATA.posters["nieve"]!,
          r2PosterUrl: row.r2_poster_url ?? undefined,
          publishDate: row.created_at ? new Date(row.created_at).toLocaleDateString("es-ES") : undefined,
        }));
        if (cancelled) return;
        setData({
          ...STUDIO_DATA,
          creator: {
            ...STUDIO_DATA.creator,
            studioName: profile.studio_name ?? "", artistName: profile.creator_name ?? "",
            bio: profile.bio ?? "", location: profile.location ?? "", role: profile.role ?? "",
            avatarUrl: profile.avatar_url ?? "", socials: (profile.social_links ?? {}) as Record<string, string>,
            stats: { ...STUDIO_DATA.creator.stats, titles: realTitles.length,
              published: realTitles.filter(t => t.status === "publicado").length },
          },
          titles: realTitles,
          storageUsedBytes: (titlesResult.data ?? []).reduce((sum, row) => sum + (Number(row.file_size_bytes) || 0), 0),
        });
        setLoadedUserId(userId);
      } catch {
        if (!cancelled) setLoadError("No se pudo cargar tu estudio. Revisa la conexión e inténtalo de nuevo.");
      }
    })();
    return () => { cancelled = true; };
  }, [userId, titlesVersion]);

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
        const err = (body as { error?: string | { message?: string } }).error;
        showToast((typeof err === "string" ? err : err?.message) ?? "Error al eliminar", { error: true });
        return;
      }
      setData((d) => {
        const titles = d.titles.filter((x) => x.id !== t.id);
        return { ...d, titles, creator: { ...d.creator, stats: { ...d.creator.stats,
          titles: titles.length, published: titles.filter(x => x.status === "publicado").length } } };
      });
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
    setFocusTitle(id === "inicio" && payload ? payload : null);
    setActiveTab(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openTitleAndGoToTitles(t: StudioTitle) {
    setActiveTab("titulos");
    setTimeout(() => setOpenTitle(t), 60);
  }

  if (loadError) {
    return <div role="alert" style={{ padding: "72px 28px", color: C.textSec }}>
      <p>{loadError}</p>
      <button className="st-btn st-btn-secondary" onClick={() => setTitlesVersion(v => v + 1)}>Reintentar</button>
    </div>;
  }
  if (authLoading || !user || loadedUserId !== user.id) {
    return <p role="status" style={{ padding: "72px 28px", color: C.textSec }}>
      {authLoading || user ? "Cargando tu estudio…" : "Inicia sesión para acceder a tu estudio."}
    </p>;
  }

  return (
    <div style={{ animation: "fadeIn 0.55s ease both" }}>
      <div className={`${styles.content} grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[220px_minmax(0,1fr)]`} style={{ maxWidth: 1360, margin: "0 auto", padding: "72px 28px 80px" }}>
        <StudioSidebar active={active} onSelect={nav} />
        <div className="min-w-0">
        {active === "inicio" && (
          <>
            <DashboardView data={data} onNav={nav} onOpenTitle={openTitleAndGoToTitles} focusTitle={focusTitle} />
          </>
        )}
        {active === "titulos" && (
          <TitlesView data={data} onNav={nav} onEditTitle={setEditTitle}
            onToast={showToast} onDelete={handleDelete} openTitle={openTitle} setOpenTitle={setOpenTitle} />
        )}
        {active === "subir" && (
          <UploadWizard onGoToTitles={() => { handlePublished(); nav("titulos"); }} />
        )}
        {active === "perfil" && (
          <ProfileView data={data} onToast={showToast} />
        )}
        </div>
      </div>

      {/* Edit modal */}
      <EditModal title={editTitle} onClose={() => setEditTitle(null)} onToast={showToast} data={data} />

      {/* Toast */}
      {toast && (
        <div className={styles.toast} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", zIndex: 200, pointerEvents: "none" }}>
          <div key={toast.key} style={{
            display: "flex", alignItems: "center", gap: 11, animation: "dropIn 0.16s ease both",
            background: "var(--gma-panel)", border: `1px solid ${C.border2}`, borderRadius: 12,
            padding: "13px 18px", boxShadow: "0 18px 44px -12px rgba(0,0,0,0.7)", maxWidth: "min(440px, calc(100vw - 32px))",
          }}>
            <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, flexShrink: 0, borderRadius: 999,
              background: toast.error ? "rgba(255,82,82,0.14)" : C.accent15,
              color: toast.error ? C.errorFg : C.accentH }}>
              {toast.error ? <AlertTriangle size={15} strokeWidth={2.4} /> : <Check size={15} strokeWidth={2.4} />}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", overflowWrap: "anywhere", minWidth: 0 }}>{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
