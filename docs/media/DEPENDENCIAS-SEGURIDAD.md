# Gate de dependencias antes de exposición externa

Estado: **exposición externa bloqueada**. La aceptación de Fase 8 utilizó el informe cacheado del 7 de octubre y el lockfile local. En V.1 se ha consultado el registro npm autorizado por el alcance del preflight y las fuentes oficiales de advisories; no se ha modificado una instancia remota ni instalado parches.

El informe conservado en `security/dependency-audit-20261007.cached.json` tiene origen en la auditoría inicial (SHA-256 del archivo original: `3f62c87f0ba395945b962fb053d7ea25c0320c664e31f4295702b2164a08fd63`). La copia se reformatea sin cambiar el JSON; es caché histórica, no una consulta vigente.

El informe histórico contiene 24 avisos (2 críticos, 16 altos, 4 moderados y 2 bajos). `npm audit --offline --json` devolvió un objeto vacío de avisos y 1005 dependencias; no garantiza que exista información vigente en caché y NO invalida los avisos históricos. Ese era el límite de Fase 8; el nuevo resultado vigente de V.1 se documenta a continuación, sin borrar el informe histórico.

## Audit vigente de V.1 — 2026-10-11

`npm audit --package-lock-only --ignore-scripts --registry=https://registry.npmjs.org --json` terminó con exit code **1 por vulnerabilidades**, no por error de red. No se ejecutó fix/install ni se modificó package-lock. Fuente completa: `security/dependency-audit-20261011.registry.json`, SHA256 `26339c1cc1a3e23570268cca840a34a523b4b2c6d8803d396a652d4bc3dff110`. Lockfile revisado SHA256 `a022df72ebe44b608173c2948f85168e6d82aa437f0fea40e0af0ae6b521a163`.

Metadata cuenta **27 dependencias vulnerables: 2 críticas, 19 altas, 4 moderadas, 2 bajas**, sobre 1005 dependencias. Es número de entradas npm, no número de CVEs distintos ni de exploits demostrados. Se mantienen Next14.2.35/proxy-addr2.0.7; el resultado actual añade tres entradas altas respecto a la caché (plugin/config ESLint Next y glob). No se rebaja el gate por tratarse parcialmente de tooling.

- [Aviso oficial Next/AVIF](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4): rango instalado afectado; el código usa next/image y remotePatterns. No se declara explotación demostrada ni se habilita AVIF para ensayarla. Otros avisos incluyen escenarios Windows, que no deben presentarse como demostrados en Ubuntu. Se requiere análisis por advisory, actualización compatible y regresión; el major sugerido por npm no se instala automáticamente.
- [Aviso oficial proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h): versión parcheada 2.0.8. `npm explain` identifica Express5.2.1 como dependencia ascendente, marcada prod en el lock. Revisar uso efectivo y confianza en IP/IPv6 y actualizar transitiva mediante ruta compatible; no afirmar aplicabilidad explotable solo por presencia, ni descartarla sin inspección.

La remediación queda sin ejecutar por alcance V.1 y WIP previo. **Exposición pública sigue bloqueada**; faltan actualización, audit posterior y suites de aceptación. Este gate no autoriza deploy de GMA por haber fijado PeerTube.

## Caché histórica de Fase 8 (conservada)

| Paquete con aviso alto/crítico en caché | Severidad | Versiones instaladas en lockfile |
|---|---|---|
| @modelcontextprotocol/sdk | high | 1.29.0 |
| @ts-morph/common | high | 0.27.0 |
| brace-expansion | high | 1.1.14, 2.1.0, 5.0.6 |
| braces | high | 3.0.3 |
| browserslist | high | 4.28.2 |
| fast-glob | high | 3.3.3 |
| fast-uri | high | 3.1.2 |
| hono | high | 4.12.21 |
| ip-address | high | 10.2.0 |
| js-yaml | high | 4.1.1 |
| micromatch | high | 4.0.8 |
| nanoid | high | 3.3.12 |
| next | critical | 14.2.35 |
| postcss | high | 8.4.31, 8.5.15 |
| proxy-addr | critical | 2.0.7 |
| shadcn | high | 4.7.0 |
| source-map-js | high | 1.2.1 |
| ts-morph | high | 26.0.0 |

## Remediación requerida en misión independiente

1. El audit inicial vigente de V.1 ya se ejecutó; repetirlo después de remediar y antes de habilitar tráfico externo. Separar runtime de tooling y comprobar explotabilidad; no rebajar riesgos por tratarse de una dependencia transitiva sin evidencia.
2. Next 14.2.35 conserva avisos críticos en el informe guardado. Crear una rama/misión propia para actualizar Next/React y dependencias compatibles; el cambio major exige revisión de middleware/Auth, RSC, imágenes, caché, CSP y toda la matriz U/I/P/R/E. No usar `audit fix --force`.
3. Revisar `proxy-addr` y la confianza en proxy/IP; no confiar en cabeceras públicas de cliente. La plantilla gateway usa dirección directa del proxy y una lista cerrada de orígenes.
4. Actualizar o retirar tooling vulnerable según uso real. El validador YAML local solo acepta archivos oficiales fijos con SHA y overrides del repositorio; no admite YAML aportado por usuarios. Ello limita la entrada actual, sin afirmar que la dependencia esté parcheada.
5. Verificar TLS/CORS públicos, uploadx real, límites/egress, private HLS/token, backups, firewall IPv6, SSRF/DNS, contratos PeerTube y sesiones después de rotación de claves en VPS PHASE. Ninguna de estas comprobaciones de red se presenta como ejecutada localmente.

Este gate admite la aceptación funcional **local en loopback** y la planificación de VPS PHASE; prohíbe exposición pública/deploy hasta aceptar la remediación y las pruebas externas.

Los rangos guardados incluyen Next 14.2.35 (`9.3.4-canary.0 - 16.3.0-preview.10`) y proxy-addr 2.0.7 (`1.1.0 - 2.0.7`). El caché propone Next 16.4.0 como cambio major; no se adopta esa versión sin verificarla de nuevo. El aviso proxy-addr guardado es GHSA-jqcg-44mw-7w3h y el de AVIF de Next GHSA-2xp9-vwfh-vxw4. Son referencias de la caché, no resultados nuevos de red.
