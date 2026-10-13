"use client";

import styles from "./studio-responsive.module.css";

import { C, card, row, Poster, StatusBadge } from "./studio-ui";
import type { StudioData, StudioTitle } from "./studio-types";

interface Props {
  data: StudioData;
  onToast: (msg: string, opts?: { error?: boolean }) => void;
  focusTitle?: StudioTitle | null;
}

export function StatsView({ data, focusTitle }: Props) {
  const titles = focusTitle ? data.titles.filter(t => t.id === focusTitle.id) : data.titles;
  return (
    <div className={styles.studio}>
      <h1 style={{ margin: "0 0 12px", fontSize: 26, fontWeight: 800 }}>Estadísticas</h1>
      <p style={{ color: C.textSec, lineHeight: 1.6, marginBottom: 24 }}>
        Tus títulos se muestran a continuación. Las métricas de visualizaciones, tiempo de reproducción,
        seguidores y valoraciones todavía no están disponibles en el estudio.
      </p>
      <div style={card({ padding: "22px 24px" })}>
        <h2 style={{ margin: "0 0 18px", fontSize: 17 }}>Tus títulos · {titles.length}</h2>
        {titles.length === 0 && <p style={{ color: C.textSec }}>Todavía no hay títulos que mostrar.</p>}
        {titles.map(title => (
          <div key={title.id} className={styles.statsRow} style={{ ...row(16), padding: "12px 0", borderTop: `1px solid ${C.border1}` }}>
            <div style={{ width: 38, flexShrink: 0 }}>
              <Poster data={title.poster} imageUrl={title.r2PosterUrl} title={title.title} rounded={6} />
            </div>
            <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", fontWeight: 700 }}>{title.title}</span>
            <StatusBadge status={title.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
