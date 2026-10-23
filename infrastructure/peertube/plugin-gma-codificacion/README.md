# Plugin de PeerTube: perfil de codificación «gma»

Añade a PeerTube el perfil de x264 `gma`. En 1080p o más usa preset `medium` y un techo de 0,07 bits por píxel (~3,5 Mbps
a 24 fps) en vez de `veryfast` y 0,10. 720p y 360p quedan como en el perfil por defecto.

Medido con VMAF sobre un minuto de 1080p difícil (2026-10-23):

| Ajuste | Mbps | VMAF |
|---|---|---|
| Perfil por defecto (`veryfast`, 0,10) | 5,21 | 95,3 |
| `gma` (`medium`, 0,07) | 3,55 | 94,2 |

Con contenido fácil el techo no actúa: la conversión se queda en lo que pide la calidad (CRF 23), como antes. A cambio, el
1080p tarda unas 3 veces más en convertirse.

## Instalar o actualizar en el VPS

La carpeta tiene que llamarse `peertube-plugin-…`: PeerTube saca el nombre del plugin de ella.

```bash
D=/var/www/peertube/peertube-plugin-gma-codificacion
sudo mkdir -p $D && sudo cp main.js package.json $D/ && sudo chown -R peertube:peertube $D
cd /var/www/peertube/peertube-latest
sudo -u peertube env NODE_CONFIG_DIR=/var/www/peertube/config NODE_ENV=production npm run plugin:install -- --plugin-path $D
sudo systemctl restart peertube
```

La primera vez, además, en `production.yaml` (bloque `transcoding`, con copia de seguridad antes): `profile: 'gma'`.
Comprobarlo: `curl -s http://127.0.0.1:9000/api/v1/config` debe dar `"profile":"gma"` en `transcoding`.

Volver al perfil por defecto: `profile: 'default'` y reiniciar PeerTube. Los vídeos ya convertidos no cambian.
