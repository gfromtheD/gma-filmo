# Pruebas de carga de GMA Filmo

Herramienta: [k6](https://k6.io) (código abierto). Recorridos reales, no peticiones sueltas:

| Script | Simula |
|---|---|
| `navegar.js` | Espectador invitado: Home → Películas/Cortos → 2–4 fichas, con las portadas que se ven al entrar |
| `ver.js` | Espectador que da a «play» y ve 2–8 min a ritmo real (HLS por la pasarela), a veces desde un punto cualquiera |

## Qué es «ir bien» (SLO)

Definido en `lib/config.js`. Si una prueba lo rompe, k6 la marca como fallida.

| Medida | Límite |
|---|---|
| Página del catálogo (p95) | < 2 s |
| Portada (p95) | < 1 s |
| Arranque del vídeo (p95: origen + listas + primer trozo) | < 5 s |
| Peticiones fallidas | < 1 % |
| Trozos que llegan más tarde de lo que duran (atascos) | < 2 % |

El **límite útil** es el número de usuarios simultáneos más alto que cumple todos.

## Lanzar

En local (pocos usuarios, para comprobar un cambio):

```bash
k6 run -e USUARIOS=5 loadtest/navegar.js
k6 run -e USUARIOS=5 -e TITULOS=gma-xxxx loadtest/ver.js
```

A escala, desde GitHub Actions (reparte los usuarios entre varias máquinas):

```bash
gh workflow run carga.yml -f escenario=ver -f forma=estres -f usuarios=100 -f maquinas=4 -f titulos=gma-xxxx
```

Formas: `carga` (sube y se mantiene), `estres` (escalones de un cuarto hasta el total), `pico` (de pocos a todos en 10 s).

Mientras dura, el servidor se observa con Netdata en el VPS (solo accesible desde dentro:
`ssh -L 19999:127.0.0.1:19999 gmaadmin@77.42.52.127` y abrir http://localhost:19999).
