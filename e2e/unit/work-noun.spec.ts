import { expect, test } from "@playwright/test";
import { workNoun } from "../../lib/comments/timestamp";

test("el aviso de duración usa el artículo de cada obra", () => {
  expect(`${workNoun("cortometraje").article} ${workNoun("cortometraje").name} dura`).toBe("El cortometraje dura");
  expect(`${workNoun("pelicula").article} ${workNoun("pelicula").name} dura`).toBe("La película dura");
});
