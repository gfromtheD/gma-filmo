# Worker audiovisual de GMA

Un proceso ejecuta un job cada vez; PostgreSQL controla el lease y el prefijo de cada intento. Next/Vercel no invoca FFmpeg.

## Requisitos MVP

- Linux con namespaces de usuario habilitados y `bubblewrap`; usuario sin privilegios.
- FFmpeg/ffprobe con libx264 y AAC, Python 3 y Node 22.
- 2 CPU como punto inicial de piloto, 4 GiB de memoria para el contenedor/proceso y volumen temporal dedicado con al menos 24 GiB libres por worker. No son resultados de capacidad para películas de cuatro horas: deben medirse en piloto.
- Secretos Supabase service-role y R2 restringidos al bucket privado nuevo. Mantenerlos fuera de la imagen, inyectados en el proceso coordinador.
- El subprocess audiovisual no recibe los secretos; tiene red aislada, raíz restringida, límites de CPU, memoria, archivos, descriptores y tiempo. Sólo ve su carpeta de trabajo y los ejecutables/librerías de lectura.

`Dockerfile` es una preparación de empaquetado. No se ha ejecutado en este Mac (Docker ausente). El host debe permitir `bubblewrap` sin hacer el contenedor privilegiado. Si el host lo impide, usar un VPS Linux con namespaces habilitados. No desactivar la comprobación para procesar archivos de usuarios.

```sh
VIDEO_PROCESSING_ENABLED=true npm run uploads:video-worker
# Para una sola iteración:
npm run uploads:video-worker -- --once
```

Además ejecutar `scripts/uploads/executor.ts` continuamente para provisión, recibos, limpieza y reconciliación. El executor de la API excluye `process`.

## Límites y política

Consultar `PROCESSING_POLICY` en `lib/uploads/video-processing.ts`: perfiles versionados 1080/720/480 según fuente, sin upscale, H.264 y AAC estéreo si hay audio, 2 threads, duración según rol, máximo 8 streams y 16 megapíxeles, seis horas de tiempo total por trabajo, 24 GiB temporales y 20 GiB de derivados. Salidas con HLS VOD, segmentos de seis segundos y póster.

Para este primer perfil se rechazan HDR y rotación declarada: necesitan políticas de transformación verificadas antes de admitirse. No se anuncia soporte multicanal, HDR, 4K o preservación del color original. El original privado sí se conserva.

Verificar outputs, playlists, referencias, duración y decodificación de todos los segmentos. Confirmar cada PUT de R2 mediante MD5 de transporte y HEAD con tamaño/SHA de metadatos del worker; el original se lee y se calcula SHA-256 completo en el worker.

La modalidad `local-test` sólo se permite en el runner instanciado expresamente para fixtures confiables y entorno local. El worker de usuarios la rechaza. macOS no valida namespaces ni el límite de memoria Linux; las pruebas reales de FFmpeg aquí no sustituyen esa prueba de aislamiento.

## Operación

- Supervisar/reiniciar el proceso con el gestor del host.
- Una señal de caída deja el job recuperable cuando vence el lease. Cada intento usa un prefijo diferente.
- El heartbeat aborta el procesamiento si pierde el lease o hay cancelación. Los writes SQL quedan cercados por propietario, job y worker.
- Un error persistente acaba en `dead`, con motivo visible en jobs/attempts; no borrar ese registro para ocultar el fallo.
- El temporal se elimina al terminar normalmente. Tras SIGKILL, el siguiente ciclo elimina carpetas con marcador de GMA de más de diez minutos cuyo worker ya no posee un lease vivo. Ante incertidumbre SQL las conserva. Usar un volumen dedicado y supervisar los residuos sin marcador.
- Alertas mínimas: jobs dead, leases expirados, espacio libre, procesamiento pendiente, bytes físicos y diferencia de ledger. Medir rendimiento con archivos largos reales antes de fijar capacidad comercial.
