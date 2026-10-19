import { expect, test } from "@playwright/test";
import {
  avatarContentFromId,
  avatarEndpointUrl,
  decodeDataImage,
  pickAvatar,
  shortHash,
} from "../../lib/profiles/avatar";

test("interpreta el identificador de avatar: icono, foto o nada", () => {
  expect(avatarContentFromId("cat")).toEqual({ kind: "icon", iconId: "cat" });
  // Un icono que no está en el catálogo (el antiguo «estrella») no se dibuja como otro: no hay avatar y sale la inicial.
  expect(avatarContentFromId("estrella")).toBeNull();
  expect(avatarContentFromId("/profiles/profile_01.jpg")).toEqual({ kind: "image", src: "/profiles/profile_01.jpg" });
  expect(avatarContentFromId("https://cdn.example.com/a.png")).toEqual({ kind: "image", src: "https://cdn.example.com/a.png" });
  expect(avatarContentFromId("data:image/webp;base64,AAAA")).toEqual({ kind: "image", src: "data:image/webp;base64,AAAA" });
  expect(avatarContentFromId("")).toBeNull();
  expect(avatarContentFromId("   ")).toBeNull();
  expect(avatarContentFromId(null)).toBeNull();
  expect(avatarContentFromId(undefined)).toBeNull();
});

test("rechaza imágenes con esquemas o rutas peligrosas (no las convierte en foto ni en icono)", () => {
  expect(avatarContentFromId("//evil.test/a.png")).toBeNull();
  expect(avatarContentFromId("http://evil.test/a.png")).toBeNull();
  expect(avatarContentFromId("javascript:alert(1)")).toBeNull();
  expect(avatarContentFromId("data:text/html;base64,AAAA")).toBeNull();
  expect(avatarContentFromId("data:image/svg+xml;base64,AAAA")).toBeNull(); // SVG incrustado puede llevar scripts
});

test("prioridad del avatar de un perfil principal: foto de creador, luego el elegido, luego la de la cuenta de Google", () => {
  const creator = "https://cdn.example.com/creador.jpg";
  const google = "https://lh3.googleusercontent.com/a/ana";
  expect(pickAvatar({ creatorPhoto: creator, chosen: "cat", providerPhoto: google })).toEqual({ kind: "image", src: creator });
  expect(pickAvatar({ creatorPhoto: null, chosen: "cat", providerPhoto: google })).toEqual({ kind: "icon", iconId: "cat" });
  expect(pickAvatar({ creatorPhoto: null, chosen: "/profiles/p1.jpg", providerPhoto: google })).toEqual({ kind: "image", src: "/profiles/p1.jpg" });
  expect(pickAvatar({ creatorPhoto: null, chosen: null, providerPhoto: google })).toEqual({ kind: "image", src: google });
  expect(pickAvatar({ creatorPhoto: null, chosen: null, providerPhoto: null })).toEqual({ kind: "initial" });
});

test("elegir «sin avatar» (cadena vacía) fuerza la inicial y no recurre a la foto de la cuenta; nulo = nunca eligió", () => {
  const google = "https://lh3.googleusercontent.com/a/ana";
  expect(pickAvatar({ chosen: "", providerPhoto: google })).toEqual({ kind: "initial" });
  expect(pickAvatar({ chosen: null, providerPhoto: google })).toEqual({ kind: "image", src: google });
  expect(pickAvatar({ chosen: undefined, providerPhoto: google })).toEqual({ kind: "image", src: google });
  // la foto de creador sigue mandando aunque se elija «sin avatar»
  expect(pickAvatar({ creatorPhoto: "https://cdn.example.com/c.jpg", chosen: "", providerPhoto: google })).toEqual({ kind: "image", src: "https://cdn.example.com/c.jpg" });
});

test("un elegido no válido no tapa a la foto de la cuenta", () => {
  const google = "https://lh3.googleusercontent.com/a/ana";
  expect(pickAvatar({ chosen: "javascript:alert(1)", providerPhoto: google })).toEqual({ kind: "image", src: google });
});

test("la foto de creador o de la cuenta solo se acepta con https", () => {
  expect(pickAvatar({ creatorPhoto: "http://x.test/a.png", chosen: "cat" })).toEqual({ kind: "icon", iconId: "cat" });
  expect(pickAvatar({ providerPhoto: "http://x.test/a.png" })).toEqual({ kind: "initial" });
});

test("decodifica una imagen incrustada y comprueba su tipo y tamaño", () => {
  const png = "data:image/png;base64," + Buffer.from([137, 80, 78, 71]).toString("base64");
  const decoded = decodeDataImage(png);
  expect(decoded?.mime).toBe("image/png");
  expect([...(decoded?.bytes ?? [])]).toEqual([137, 80, 78, 71]);
  expect(decodeDataImage("data:image/jpeg;base64,/9j/4AAQ")?.mime).toBe("image/jpeg");
  expect(decodeDataImage("data:image/webp;base64,UklGRg==")?.mime).toBe("image/webp");
});

test("no decodifica tipos no permitidos, datos que no son base64 ni imágenes demasiado grandes", () => {
  expect(decodeDataImage("data:image/svg+xml;base64,AAAA")).toBeNull();
  expect(decodeDataImage("data:text/html;base64,AAAA")).toBeNull();
  expect(decodeDataImage("data:image/png,no-es-base64")).toBeNull();
  expect(decodeDataImage("https://x.test/a.png")).toBeNull();
  expect(decodeDataImage("")).toBeNull();
  const huge = "data:image/png;base64," + "A".repeat(4_000_000);
  expect(decodeDataImage(huge)).toBeNull();
});

test("la dirección de la imagen cambia cuando cambia el contenido (para la caché)", () => {
  const a = avatarEndpointUrl("u1", "", "data:image/png;base64,AAAA");
  const b = avatarEndpointUrl("u1", "", "data:image/png;base64,BBBB");
  expect(a).toMatch(/^\/api\/avatar\?u=u1&p=&v=[0-9a-z]+$/);
  expect(a).not.toBe(b);
  expect(avatarEndpointUrl("u1", "", "data:image/png;base64,AAAA")).toBe(a);
  expect(avatarEndpointUrl("u1", "p_9", "data:image/png;base64,AAAA")).toContain("p=p_9");
});

test("la huella corta es estable y distingue textos", () => {
  expect(shortHash("hola")).toBe(shortHash("hola"));
  expect(shortHash("hola")).not.toBe(shortHash("adios"));
});
