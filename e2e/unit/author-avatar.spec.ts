import { expect, test } from "@playwright/test";
import { authorKey, resolveAuthor, type AccountProfile, type SubProfile } from "../../lib/profiles/author-avatar";

const account: AccountProfile = {
  username: "ana_cuenta",
  avatar_url: "https://lh3.googleusercontent.com/a/ana",
  avatar_color: "#22B16B",
  avatar_id: null,
};
const base = { userId: "u1", profileId: "", account, sub: null, creatorPhoto: null } as const;

test("perfil principal sin avatar elegido: usa la foto de la cuenta de Google, el nombre y el color", () => {
  expect(resolveAuthor(base)).toEqual({
    displayName: "@ana_cuenta",
    avatarUrl: "https://lh3.googleusercontent.com/a/ana",
    avatarIconId: null,
    avatarColor: "#22B16B",
  });
});

test("perfil principal con un icono elegido: el icono manda sobre la foto de la cuenta", () => {
  expect(resolveAuthor({ ...base, account: { ...account, avatar_id: "cat" } })).toEqual({
    displayName: "@ana_cuenta",
    avatarUrl: null,
    avatarIconId: "cat",
    avatarColor: "#22B16B",
  });
});

test("perfil principal con una foto propia elegida: la foto manda sobre la de la cuenta", () => {
  const result = resolveAuthor({ ...base, account: { ...account, avatar_id: "/profiles/profile_07.jpg" } });
  expect(result.avatarUrl).toBe("/profiles/profile_07.jpg");
  expect(result.avatarIconId).toBeNull();
});

test("la foto de creador manda sobre todo en el perfil principal", () => {
  const result = resolveAuthor({
    ...base,
    account: { ...account, avatar_id: "cat" },
    creatorPhoto: "https://cdn.example.com/creador.jpg",
  });
  expect(result.avatarUrl).toBe("https://cdn.example.com/creador.jpg");
  expect(result.avatarIconId).toBeNull();
});

test("con un perfil secundario se ve el @ de la cuenta, no el nombre del perfil", () => {
  const sub: SubProfile = { name: "Perfil 2", avatar_id: "cat", color: "purple" };
  expect(resolveAuthor({ ...base, profileId: "p_2", sub }).displayName).toBe("@ana_cuenta");
});

test("una cuenta sin @ (migración sin aplicar) sale como «Usuario», nunca con un nombre personal", () => {
  expect(resolveAuthor({ ...base, account: { ...account, username: null } }).displayName).toBe("Usuario");
});

test("la foto de creador no se aplica a un perfil secundario", () => {
  const sub: SubProfile = { name: "Perfil 2", avatar_id: "cat", color: "purple" };
  const result = resolveAuthor({ ...base, profileId: "p_2", sub, creatorPhoto: "https://cdn.example.com/creador.jpg" });
  expect(result).toEqual({ displayName: "@ana_cuenta", avatarUrl: null, avatarIconId: "cat", avatarColor: "purple" });
});

test("un perfil secundario con foto propia usa el @ de la cuenta, su foto y su color", () => {
  const sub: SubProfile = { name: "Perfil 2", avatar_id: "/profiles/profile_07.png", color: "purple" };
  expect(resolveAuthor({ ...base, profileId: "p_2", sub })).toEqual({
    displayName: "@ana_cuenta",
    avatarUrl: "/profiles/profile_07.png",
    avatarIconId: null,
    avatarColor: "purple",
  });
});

test("un perfil secundario sin avatar (o con uno no válido) no hereda la foto de la cuenta: sale su inicial", () => {
  const empty = resolveAuthor({ ...base, profileId: "p_2", sub: { name: "Sin avatar", avatar_id: "", color: "red" } });
  expect(empty).toEqual({ displayName: "@ana_cuenta", avatarUrl: null, avatarIconId: null, avatarColor: "red" });
  const bad = resolveAuthor({ ...base, profileId: "p_2", sub: { name: "X", avatar_id: "javascript:alert(1)", color: "red" } });
  expect(bad.avatarUrl).toBeNull();
  expect(bad.avatarIconId).toBeNull();
});

test("una imagen incrustada se sirve por una dirección corta y estable, no embebida", () => {
  const data = "data:image/webp;base64,UklGRg==";
  const sub = resolveAuthor({ ...base, profileId: "p_2", sub: { name: "P", avatar_id: data, color: "blue" } });
  expect(sub.avatarUrl).toMatch(/^\/api\/avatar\?u=u1&p=p_2&v=[0-9a-z]+$/);
  const main = resolveAuthor({ ...base, account: { ...account, avatar_id: data } });
  expect(main.avatarUrl).toMatch(/^\/api\/avatar\?u=u1&p=&v=[0-9a-z]+$/);
  expect(main.avatarUrl).not.toContain("base64");
});

test("sin cuenta ni perfil se usa el nombre de respaldo y no hay foto", () => {
  expect(resolveAuthor({ userId: "u1", profileId: "", account: null, sub: null, creatorPhoto: null, fallbackName: "Usuario" })).toEqual({
    displayName: "Usuario",
    avatarUrl: null,
    avatarIconId: null,
    avatarColor: null,
  });
});

test("la clave de autor distingue el perfil principal de cada perfil secundario", () => {
  expect(authorKey("u1", "")).toBe("u1|");
  expect(authorKey("u1", null)).toBe("u1|");
  expect(authorKey("u1", undefined)).toBe("u1|");
  expect(authorKey("u1", "p_1")).toBe("u1|p_1");
  expect(authorKey("u1", "p_1")).not.toBe(authorKey("u2", "p_1"));
});
