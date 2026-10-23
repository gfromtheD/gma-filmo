# P2P para estrenos (aplazado)

Decisión del 2026-10-23: **no se activa todavía**. Con el semáforo de calidad y el perfil `gma`, el VPS aguanta ~260
espectadores a la vez en 1080p, o ~450 mezclando 1080p y 720p (prueba de carga de 200 espectadores: 90 % del tiempo en 1080p,
0,06 % de vídeos parados, CPU al 27 %; el límite es la red de 1 Gbit/s). El P2P solo compensa cuando muchos ven **la misma**
obra **a la vez**, y añade un coste de privacidad. Se retoma cuando un estreno se acerque a ese límite.

## Cuándo retomarlo

- El semáforo de `/playback/carga` pasa a «media» o «baja» en estrenos reales (no en pruebas).
- O se prevé un estreno con más de ~250 espectadores simultáneos.

## Cómo se haría

1. **Reproductor**: `p2p-media-loader-hlsjs` (Novage, v2) sobre nuestro hls.js 1.7, solo en títulos publicados (nunca en
   vistas previas privadas del estudio).
2. **Identidad del enjambre**: las URL de los trozos llevan la capacidad de cada espectador (`?cap=…`), así que nadie
   coincidiría con nadie. Hay que fijar `swarmId` = `<asset>:<generación>` para que el enjambre no dependa de la URL.
3. **Tracker**: el de PeerTube (`tracker.enabled: true` en `production.yaml`; nginx ya envía `/tracker/socket`).
4. **Semáforo**: el P2P no cambia las reglas de calidad; solo reduce lo que sale del VPS.
5. **Medición**: k6 no habla WebRTC. Hay que probarlo con navegadores reales (Playwright en varias máquinas) y comparar la
   salida del VPS con y sin P2P.

## Privacidad (obligatorio antes de activarlo)

- Con WebRTC cada espectador ve la IP de los demás con los que comparte trozos: es un dato personal (RGPD).
- Hay que explicarlo en la política de privacidad, avisar en el reproductor y ofrecer desactivarlo (ajustes del reproductor).
- Los espectadores ponen parte de su subida: limitarla y no compartir con datos móviles.
