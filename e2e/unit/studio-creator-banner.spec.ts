import { expect, test } from "@playwright/test";
import { pickStudioBanner } from "../../lib/studio-creator-banner";

const rows = [
  { creator_name: "Marta Ruiz", studio_name: "Faro Films", banner_url: "https://cdn/marta.jpg" },
  { creator_name: "Pablo Gil", studio_name: null, banner_url: null },
];

test.describe("banner del estudio en la página pública", () => {
  test("usa el banner de la cuenta cuyo nombre artístico coincide con la página", () => {
    expect(pickStudioBanner("marta  ruiz", rows)).toBe("https://cdn/marta.jpg");
  });

  test("también coincide por el nombre del estudio", () => {
    expect(pickStudioBanner("Faro Films", rows)).toBe("https://cdn/marta.jpg");
  });

  test("no pone el banner del autor de la obra en la página de otra persona del reparto", () => {
    expect(pickStudioBanner("Lucía Prieto", rows)).toBeNull();
  });

  test("sin banner subido no devuelve nada", () => {
    expect(pickStudioBanner("Pablo Gil", rows)).toBeNull();
  });
});
