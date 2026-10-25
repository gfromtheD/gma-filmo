import { expect, test } from "@playwright/test";
import { claimHref } from "../../lib/creator-claim";
import { applyStudioProfile, pickStudioBanner, pickStudioProfile } from "../../lib/studio-creator-banner";

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

test.describe("ficha de Mi Estudio en la página pública", () => {
  const pablo = {
    creator_name: "Pablo Parés", studio_name: "Cine Salvaje", banner_url: "https://cdn/banner.jpg", avatar_url: "https://cdn/pablo.jpg",
    bio: "Director argentino de cine fantástico.", location: "Buenos Aires, Argentina",
    social_links: { instagram: "https://instagram.com/pablopares", web: "" }, gestionado: true,
  };
  const catalogo = {
    slug: "pablo-pares", nombre: "Pablo Parés", foto_perfil: null, imagen_portada: null, nacionalidad: null, bio: "Bio del catálogo",
    redes_sociales: [], donacion_paypal: null, donacion_patreon: null, donacion_bitcoin: null, titulos: ["plaga-zombie"], editorial: true,
  };

  test("la foto, la bio, la ubicación, las redes y el banner de la ficha mandan sobre los del catálogo", () => {
    const perfil = applyStudioProfile(catalogo, pickStudioProfile("pablo  parés", [pablo]));
    expect(perfil.foto_perfil).toBe("https://cdn/pablo.jpg");
    expect(perfil.imagen_portada).toBe("https://cdn/banner.jpg");
    expect(perfil.bio).toBe("Director argentino de cine fantástico.");
    expect(perfil.nacionalidad).toBe("Buenos Aires, Argentina");
    expect(perfil.redes_sociales).toEqual([{ platform: "instagram", url: "https://instagram.com/pablopares" }]);
    expect(perfil.gestionado).toBe(true);
    expect(perfil.titulos).toEqual(["plaga-zombie"]);
  });

  test("lo que la ficha deja vacío se queda como estaba en el catálogo", () => {
    const perfil = applyStudioProfile(catalogo, pickStudioProfile("Pablo Parés", [{ ...pablo, bio: "  ", avatar_url: null, gestionado: false }]));
    expect(perfil.bio).toBe("Bio del catálogo");
    expect(perfil.foto_perfil).toBeNull();
    expect(perfil.gestionado).toBe(false);
  });

  test("sin cuenta con ese nombre, la página no cambia", () => {
    expect(applyStudioProfile(catalogo, pickStudioProfile("Otra Persona", [pablo]))).toEqual(catalogo);
  });
});

test.describe("reclamar un perfil gestionado", () => {
  test("con correo del equipo, abre un email con el asunto ya escrito", () => {
    expect(claimHref("Pablo Parés", "equipo@gma.example")).toBe("mailto:equipo@gma.example?subject=Reclamar%20mi%20perfil%20de%20GMA%20Filmo%3A%20Pablo%20Par%C3%A9s");
  });

  test("sin correo configurado (o con uno mal escrito), lleva al Instagram de GMA", () => {
    expect(claimHref("Pablo Parés", undefined)).toBe("https://www.instagram.com/genartmal/");
    expect(claimHref("Pablo Parés", "no-es-un-correo")).toBe("https://www.instagram.com/genartmal/");
  });
});
