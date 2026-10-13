const BASE_URL = `http://localhost:${process.env.E2E_PORT ?? 3000}`;

/**
 * Precalienta las rutas que usan las pruebas: en `next dev` la primera petición
 * compila la ruta y puede recargar la página a mitad de una prueba.
 */
export default async function globalSetup(): Promise<void> {
  const headers = { cookie: "gma_guest=1" };
  for (const path of ["/inicio"]) {
    await fetch(`${BASE_URL}${path}`, { headers, redirect: "manual" });
  }
}
