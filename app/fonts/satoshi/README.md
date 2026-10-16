# Satoshi (tipografía de GMA Filmo)

Satoshi, de Indian Type Foundry (Fontshare), bajo la **ITF Free Font License 2.0** (ver `FFL.txt`): uso gratuito, también
comercial, y se puede alojar en nuestra propia web con `@font-face`.

La licencia **prohíbe redistribuir** los archivos de la fuente (incluidos repositorios públicos) y **modificarlos**
(incluye recortarlos o convertirlos de formato). Por eso:

- Los `.woff2` están en `.gitignore` y **no se suben al repositorio**. Solo se versionan este README y `FFL.txt`.
- Los archivos se usan tal cual los entrega Fontshare (`Satoshi-Variable.woff2` y `Satoshi-VariableItalic.woff2`).
- Quien clone el proyecto debe descargar la fuente en <https://www.fontshare.com/fonts/satoshi> y copiar esos dos
  archivos aquí (carpeta `Satoshi_Complete/Fonts/WEB/fonts/`).

## Cómo llegan los archivos a producción

`npm run build` ejecuta antes `scripts/fetch-satoshi.mjs` (`prebuild`): si faltan los `.woff2`, los descarga de Fontshare, tal cual y sin modificarlos. En el equipo de desarrollo, si ya están en esta carpeta, no se descarga nada.
