# Cómo contribuir a GMA Filmo

¡Gracias por querer ayudar! GMA Filmo es un proyecto abierto y cualquier aporte cuenta: código, diseño, pruebas, documentación, traducciones o un buen reporte de fallo.

## Antes de empezar

- **Busca en los [issues](https://github.com/gfromtheD/gma-filmo/issues)** por si alguien ya está con lo mismo.
- **Si el cambio es grande** (una función nueva, cambios en la base de datos o en el motor multimedia), abre primero un issue y cuéntalo. Así nadie pierde tiempo.
- Para fallos de seguridad, **no abras un issue público**: contacta de forma privada con quien mantiene el proyecto.

## Preparar tu entorno

Sigue los pasos de [Empezar en local](./README.md#-empezar-en-local) del README. En resumen:

```bash
git clone https://github.com/<tu-usuario>/gma-filmo.git
cd gma-filmo
npm install
cp .env.uploads.example .env.local   # rellena tus claves de Supabase
npm run dev
```

## Flujo de trabajo

1. Haz un **fork** y crea una rama desde `main`:
   - `feat/…` para funciones nuevas
   - `fix/…` para correcciones
   - `docs/…` para documentación
2. Escribe **commits pequeños y descriptivos** con [Conventional Commits](https://www.conventionalcommits.org/es/):
   ```text
   feat(player): añadir selector de velocidad
   fix(studio): conservar la ficha al recargar la página
   docs(readme): aclarar las variables de entorno
   ```
3. **Comprueba tu cambio** antes de enviarlo:
   ```bash
   npm run lint
   npm run test:e2e            # si tocas la interfaz
   npm run test:media:unit     # si tocas lib/media o lib/studio-media
   ```
4. Abre un **pull request** contra `main` explicando:
   - qué cambia y por qué,
   - cómo probarlo,
   - capturas o vídeo si afecta a la interfaz.

## Normas del código

- **TypeScript** en todo el proyecto; evita `any`.
- Valida las entradas de la API con **Zod**.
- Usa los componentes de `components/ui` y Tailwind antes de crear estilos nuevos.
- **Migraciones solo aditivas**: no borres ni renombres columnas o tablas. Añade un archivo nuevo en `supabase/migrations/` con la fecha como prefijo.
- **Nunca subas secretos** (`.env.local`, claves, contraseñas). Las plantillas `*.example` no deben llevar valores reales.
- Las credenciales del proveedor de vídeo y la `SUPABASE_SERVICE_ROLE_KEY` son **solo de servidor**: jamás con prefijo `NEXT_PUBLIC_`.
- Mantén los textos de la interfaz en español y con un tono cercano.

## Reportar un fallo

Abre un issue con:

- qué esperabas que pasara y qué pasó,
- los pasos para reproducirlo,
- navegador, sistema operativo y dispositivo,
- capturas o mensajes de error si los hay.

## Licencia

Al contribuir aceptas que tu aporte se publique bajo la [licencia MIT](./LICENSE) del proyecto.
