import { expect, test } from "@playwright/test";
import { hasLiked, isOwnComment, ownsStoredComment } from "../../lib/comments/ownership";

const ACCOUNT = "user-1";

test.describe("isOwnComment (cada perfil gestiona lo suyo)", () => {
  test("es propio si coinciden cuenta y perfil", () => {
    expect(isOwnComment({ user_id: ACCOUNT, profile_id: "p_a" }, ACCOUNT, "p_a")).toBe(true);
  });

  test("no es propio si otro perfil de la misma cuenta lo escribió", () => {
    expect(isOwnComment({ user_id: ACCOUNT, profile_id: "p_a" }, ACCOUNT, "p_b")).toBe(false);
    expect(isOwnComment({ user_id: ACCOUNT, profile_id: "p_a" }, ACCOUNT, "")).toBe(false);
  });

  test("un comentario sin perfil se atribuye al perfil principal", () => {
    expect(isOwnComment({ user_id: ACCOUNT, profile_id: null }, ACCOUNT, "")).toBe(true);
    expect(isOwnComment({ user_id: ACCOUNT, profile_id: undefined }, ACCOUNT, "")).toBe(true);
    expect(isOwnComment({ user_id: ACCOUNT, profile_id: null }, ACCOUNT, "p_a")).toBe(false);
  });

  test("nunca es propio de otra cuenta ni sin sesión", () => {
    expect(isOwnComment({ user_id: "otro", profile_id: "p_a" }, ACCOUNT, "p_a")).toBe(false);
    expect(isOwnComment({ user_id: ACCOUNT, profile_id: "" }, null, "")).toBe(false);
  });
});

test.describe("ownsStoredComment (servidor)", () => {
  test("exige la misma cuenta y el mismo perfil", () => {
    expect(ownsStoredComment({ user_id: ACCOUNT, profile_id: "p_a" }, ACCOUNT, "p_a")).toBe(true);
    expect(ownsStoredComment({ user_id: ACCOUNT, profile_id: "p_a" }, ACCOUNT, "p_b")).toBe(false);
    expect(ownsStoredComment({ user_id: ACCOUNT, profile_id: null }, ACCOUNT, "")).toBe(true);
  });
});

test.describe("hasLiked («De acuerdo» por perfil)", () => {
  const likes = [{ user_id: ACCOUNT, profile_id: "p_a" }, { user_id: "otro", profile_id: "" }];

  test("solo cuenta el perfil que lo dio", () => {
    expect(hasLiked(likes, ACCOUNT, "p_a")).toBe(true);
    expect(hasLiked(likes, ACCOUNT, "p_b")).toBe(false);
    expect(hasLiked(likes, ACCOUNT, "")).toBe(false);
  });

  test("los antiguos sin perfil son del perfil principal", () => {
    expect(hasLiked([{ user_id: ACCOUNT, profile_id: null }], ACCOUNT, "")).toBe(true);
    expect(hasLiked([{ user_id: ACCOUNT }], ACCOUNT, "p_a")).toBe(false);
  });

  test("sin sesión nunca", () => {
    expect(hasLiked(likes, null, "")).toBe(false);
  });
});
