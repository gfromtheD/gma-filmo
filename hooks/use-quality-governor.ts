'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackEngine } from '@/lib/media/playback-engines';
import { aplicarPreferencia, esNivel, retrasoSubida, techoPara, type Nivel, type Preferencia } from '@/lib/media/quality-governor';
import type { PlaybackSource } from '@/types/playback';

/** Cada cuánto se consulta el semáforo de la pasarela. */
const CONSULTA_MS = 20_000;

/**
 * Aplica al reproductor el reparto de calidad por carga (ver lib/media/quality-governor.ts). Solo en HLS del motor: la
 * pasarela que sirve el vídeo es la misma que publica `/carga`. Si el semáforo no responde, no se limita nada.
 */
export function useQualityGovernor(engine: PlaybackEngine | null, source: PlaybackSource | null) {
  const [niveles, setNiveles] = useState<number[]>([]);
  const [preferencia, setPreferenciaState] = useState<Preferencia>('auto');
  const [esperando, setEsperando] = useState(false);
  const preferenciaRef = useRef<Preferencia>('auto');
  const techoRef = useRef(Number.POSITIVE_INFINITY);
  const aplicar = useRef<() => void>(() => {});

  useEffect(() => { engine?.onLevelsChanged(setNiveles); }, [engine]);

  const url = source?.kind === 'hls' ? source.url : null;
  useEffect(() => {
    if (!engine || !url) return;
    let alive = true, nuevo = true, nivel: Nivel = 'alta', desdeBaja: number | null = null;
    let subida: ReturnType<typeof setTimeout> | undefined;
    const origin = new URL(url).origin;

    const poner = (techo: number) => {
      techoRef.current = techo;
      desdeBaja = Number.isFinite(techo) ? desdeBaja ?? Date.now() : null;
      const { esperando: espera } = aplicarPreferencia(techo, preferenciaRef.current);
      engine.setQuality(techo, preferenciaRef.current === 'auto' ? null : preferenciaRef.current);
      setEsperando(espera);
    };
    aplicar.current = () => poner(techoRef.current);

    const consultar = async () => {
      try {
        const res = await fetch(`${origin}/carga`, { cache: 'no-store' });
        const body = res.ok ? await res.json() as { nivel?: unknown } : null;
        nivel = esNivel(body?.nivel) ? body.nivel : 'alta';
      } catch { nivel = 'alta'; }
      if (!alive) return;
      const techo = techoPara(nivel, { nuevo, alturaActual: engine.currentHeight() });
      nuevo = false;
      clearTimeout(subida);
      // Bajar es inmediato (hay que hacer sitio ya); subir espera menos cuanto más tiempo se lleva en baja calidad.
      if (techo <= techoRef.current) poner(techo);
      else subida = setTimeout(() => { if (alive) poner(techo); }, retrasoSubida(desdeBaja ? Date.now() - desdeBaja : 0));
    };

    void consultar();
    const timer = setInterval(() => void consultar(), CONSULTA_MS);
    return () => { alive = false; clearInterval(timer); clearTimeout(subida); techoRef.current = Number.POSITIVE_INFINITY; };
  }, [engine, url]);

  const setPreferencia = useCallback((valor: Preferencia) => {
    preferenciaRef.current = valor; setPreferenciaState(valor); aplicar.current();
  }, []);

  return { niveles, preferencia, setPreferencia, esperando };
}
