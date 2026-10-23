import { test, expect } from "@playwright/test";
import { optionalJsonBody } from "../../lib/uploads/http";

const url = "http://localhost/api/titles/x";

test.describe("optionalJsonBody", () => {
  test("un DELETE sin cuerpo devuelve undefined (el panel de Mi Estudio no envía nada)", async () => {
    expect(await optionalJsonBody(new Request(url, { method: "DELETE" }))).toBeUndefined();
  });

  test("un cuerpo en blanco también cuenta como vacío", async () => {
    expect(await optionalJsonBody(new Request(url, { method: "DELETE", body: "  \n" }))).toBeUndefined();
  });

  test("un cuerpo JSON válido se lee", async () => {
    const body = await optionalJsonBody(new Request(url, { method: "DELETE", body: JSON.stringify({ revision: 3 }) }));
    expect(body).toEqual({ revision: 3 });
  });

  test("un cuerpo que no es JSON falla con 400", async () => {
    await expect(optionalJsonBody(new Request(url, { method: "DELETE", body: "{no" }))).rejects.toMatchObject({ status: 400 });
  });
});
