# Regresiones visuales y funcionales — registro

## Fase B — Navbar (2026-10-13)

**Línea base (antes):** 30 de 40 pruebas E2E en rojo (móvil, menú de cuenta, semántica). Escritorio visual correcto.

**Después:** 44/44 pruebas E2E en verde (`npm run test:e2e`).

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | limpio |
| `next lint` | 0 errores; 4 avisos previos, ninguno nuevo |
| `next build` | correcto (`exit 0`) |
| Escritorio 1440 px, antes/después | cabecera idéntica (diferencia solo en la diapositiva del hero, que rota sola) |
| Móvil 320–430 px | sin controles recortados; panel, buscador y cuenta alcanzables |
| Consola | 0 errores a 390 y 1280 px |
| Teclado | Escape cierra panel y menú de cuenta y devuelve el foco; píldora de creador operable |

### Regresión introducida y corregida durante la fase

- **Aviso de hidratación** (`Prop style did not match`) por usar `useReducedMotion()` en un estilo
  en línea del chip de cuenta (valor distinto en servidor y cliente). Detectado al repetir la
  matriz; corregido moviendo la reducción de movimiento a CSS (`motion-reduce:`) y protegido con
  una prueba E2E que falla ante cualquier error de consola.

### Limitaciones conocidas (honestas)

- No se probó con un **creador autenticado**: la ruleta Mi Espacio/Mi Estudio, el panel móvil con «Mi
  Estudio» y la fila de Studio solo están verificados por tipos, lint y revisión de código.
- No se probó en dispositivo táctil real ni con lector de pantalla; solo emulación y árbol de accesibilidad.
- Las capturas de comparación están en el directorio temporal de la sesión, no en el repositorio.
- No se midió rendimiento (Lighthouse/INP) en esta fase.
