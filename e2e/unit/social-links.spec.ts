import { expect, test } from "@playwright/test";
import { socialUrl } from "../../lib/social-links";

test.describe("enlaces de Letterboxd", () => {
  test("Letterboxd acepta el usuario o su URL", () => {
    expect(socialUrl("letterboxd", "marta")).toBe("https://letterboxd.com/marta");
    expect(socialUrl("letterboxd", "https://letterboxd.com/marta/")).toBe("https://letterboxd.com/marta/");
  });

  test("rechaza enlaces de otra web", () => {
    expect(socialUrl("letterboxd", "https://evil.com/marta")).toBeNull();
  });
});
