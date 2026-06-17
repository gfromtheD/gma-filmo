"use client";

import { useState, useEffect } from "react";
import { Home, Film, Upload, BarChart2, User, Check, AlertTriangle } from "lucide-react";
import { DashboardView } from "./studio-dashboard-view";
import { TitlesView }    from "./studio-titles-view";
import { UploadView }    from "./studio-upload-view";
import { StatsView }     from "./studio-stats-view";
import { ProfileView }   from "./studio-profile-view";
import { EditModal }     from "./studio-edit-modal";
import { C, row }        from "./studio-ui";
import { STUDIO_DATA }   from "./studio-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { StudioTitle, StudioTabId } from "./studio-types";
export type { StudioTabId };

const TABS: { id: StudioTabId; label: string; icon: React.ReactNode }[] = [
  { id: "inicio",       label: "Inicio",         icon: <Home size={15} /> },
  { id: "titulos",      label: "Mis títulos",     icon: <Film size={15} /> },
  { id: "subir",        label: "Subir",           icon: <Upload size={15} /> },
  { id: "estadisticas", label: "Estadísticas",    icon: <BarChart2 size={15} /> },
  { id: "perfil",       label: "Perfil",          icon: <User size={15} /> },
];

export function StudioScreen() {
  const [active,    setActive]    = useState<StudioTabId>("inicio");
  const [editTitle, setEditTitle] = useState<StudioTitle | null>(null);
  const [openTitle, setOpenTitle] = useState<StudioTitle | null>(null);
  const [focusTitle, setFocusTitle] = useState<StudioTitle | null>(null);
  const [toast,     setToast]     = useState<{ msg: string; error?: boolean; key: number } | null>(null);
  const [data,      setData]      = useState(STUDIO_DATA);

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

  function showToast(msg: string, opts?: { error?: boolean }) {
    setToast({ msg, error: opts?.error, key: Date.now() });
    setTimeout(() => setToast(null), 3200);
  }

  function nav(id: StudioTabId, payload?: StudioTitle) {
    if (id === "estadisticas" && payload) setFocusTitle(payload);
    setActive(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openTitleAndGoToTitles(t: StudioTitle) {
    setActive("titulos");
    setTimeout(() => setOpenTitle(t), 60);
  }

  return (
    <div style={{ animation: "fadeIn 0.55s ease both" }}>
      {/* Internal tab nav */}
      <div style={{ borderBottom: `1px solid ${C.border1}`, marginBottom: 0 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px" }}>
          <div style={row(4)}>
            {TABS.map(t => {
              const isActive = active === t.id;
              return (
                <button key={t.id} onClick={() => nav(t.id)}
                  style={{
                    ...row(7),
                    height: 48, padding: "0 16px", border: "none", cursor: "pointer",
                    fontSize: 13.5, fontWeight: 700, fontFamily: "inherit",
                    transition: "all 0.18s ease",
                    background: "transparent",
                    color: isActive ? C.accentH : C.textMuted,
                    borderBottom: `2px solid ${isActive ? C.accent : "transparent"}`,
                    borderRadius: 0,
                    marginBottom: -1,
                  }}>
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* View content */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "38px 28px 80px" }}>
        {active === "inicio" && (
          <DashboardView data={data} onNav={nav} onOpenTitle={openTitleAndGoToTitles} />
        )}
        {active === "titulos" && (
          <TitlesView data={data} onNav={nav} onEditTitle={setEditTitle}
            onToast={showToast} openTitle={openTitle} setOpenTitle={setOpenTitle} />
        )}
        {active === "subir" && (
          <UploadView data={data} onToast={showToast} onNav={nav} />
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
