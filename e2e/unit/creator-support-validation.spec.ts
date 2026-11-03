import { expect, test } from "@playwright/test";
import { bitcoinAddress, patreonHref, paypalHref, supportLinkProblem, supportMethods } from "../../lib/creator-support";
import { applyStudioProfile, pickStudioProfile } from "../../lib/studio-creator-banner";
import type { CreatorProfile } from "../../types/creator";

test.describe("métodos de apoyo del creador", () => {
  test("PayPal: acepta paypal.me y botones de donación, y rechaza lo demás", () => {
    expect(paypalHref("https://paypal.me/ana")).toBe("https://paypal.me/ana");
    expect(paypalHref("https://www.paypal.com/donate?hosted_button_id=ABC")).toContain("hosted_button_id");
    expect(paypalHref("https://paypal.com/signin")).toBeNull();
    expect(paypalHref("https://evil.example/paypal.me/ana")).toBeNull();
    expect(paypalHref("javascript:alert(1)")).toBeNull();
  });

  test("Patreon: acepta la página de un creador y rechaza rutas del propio Patreon", () => {
    expect(patreonHref("https://www.patreon.com/ana")).toBe("https://www.patreon.com/ana");
    expect(patreonHref("https://www.patreon.com/login")).toBeNull();
    expect(patreonHref("https://patreon.example.com/ana")).toBeNull();
  });

  test("Bitcoin: solo direcciones de mainnet, sin importes ni parámetros", () => {
    expect(bitcoinAddress("bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")).toBe("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq");
    expect(bitcoinAddress("1BoatSLRHtKNngkdXEeobR76b53LETtpyT")).toBe("1BoatSLRHtKNngkdXEeobR76b53LETtpyT");
    expect(bitcoinAddress("bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=1")).toBeNull();
    expect(bitcoinAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx")).toBeNull();
  });

  test("supportLinkProblem: vacío o válido no da problema; inválido, sí", () => {
    expect(supportLinkProblem("paypal", "")).toBeNull();
    expect(supportLinkProblem("paypal", "https://paypal.me/ana")).toBeNull();
    expect(supportLinkProblem("patreon", "https://example.com/x")).toContain("Patreon");
    expect(supportLinkProblem("bitcoin", "no-es-una-direccion")).toContain("Bitcoin");
  });

  test("lo que escribe el creador en Mi Estudio manda sobre lo del catálogo, y lo vacío lo deja como estaba", () => {
    const profile = { nombre: "Ana", donacion_paypal: "https://paypal.me/vieja", donacion_patreon: "https://www.patreon.com/vieja" } as unknown as CreatorProfile;
    const overlay = pickStudioProfile("Ana", [{ creator_name: "Ana", studio_name: null, banner_url: null, donacion_paypal: "https://paypal.me/nueva", donacion_patreon: "  " }]);
    const merged = applyStudioProfile(profile, overlay);
    expect(merged.donacion_paypal).toBe("https://paypal.me/nueva");
    expect(merged.donacion_patreon).toBe("https://www.patreon.com/vieja");
    expect(supportMethods(merged).map((m) => m.key)).toEqual(["paypal", "patreon"]);
  });
});
