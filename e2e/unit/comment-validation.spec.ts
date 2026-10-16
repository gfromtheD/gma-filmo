import { expect, test } from "@playwright/test";
import {
  attachAuthors,
  attachReplyTargets,
  checkReplyTarget,
  canCreatorAct,
  flagCreator,
  parseCommentPatch,
  checkParent,
  commentErrorMessage,
  countComments,
  groupThreads,
  parseCommentBody,
  type ParentRow,
} from "../../lib/comments/validation";
import { authorKey } from "../../lib/profiles/author-avatar";

const OK_BODY = { peliculaId: 7, content: "  Qué buen corto  " };

test("acepta un comentario válido y limpia el texto", () => {
  const result = parseCommentBody(OK_BODY);
  expect(result).toEqual({
    ok: true,
    data: { peliculaId: 7, content: "Qué buen corto", timestampRef: null, parentId: null, profileId: "", replyToId: null },
  });
});

test("rechaza cuerpos que no son un objeto o con tipos incorrectos", () => {
  expect(parseCommentBody(null).ok).toBe(false);
  expect(parseCommentBody("hola").ok).toBe(false);
  expect(parseCommentBody([]).ok).toBe(false);
  expect(parseCommentBody({ peliculaId: "7", content: "x" }).ok).toBe(false);
  expect(parseCommentBody({ peliculaId: 7.5, content: "x" }).ok).toBe(false);
  expect(parseCommentBody({ peliculaId: 0, content: "x" }).ok).toBe(false);
  expect(parseCommentBody({ peliculaId: -3, content: "x" }).ok).toBe(false);
  expect(parseCommentBody({ peliculaId: 7, content: 123 }).ok).toBe(false);
  expect(parseCommentBody({ peliculaId: 7 }).ok).toBe(false);
});

test("rechaza un texto vacío o solo con espacios", () => {
  expect(parseCommentBody({ peliculaId: 7, content: "" }).ok).toBe(false);
  expect(parseCommentBody({ peliculaId: 7, content: "   \n  " }).ok).toBe(false);
});

test("recorta el texto a 1.000 caracteres", () => {
  const result = parseCommentBody({ peliculaId: 7, content: "a".repeat(1500) });
  expect(result.ok && result.data.content.length).toBe(1000);
});

test("el momento debe ser un entero no negativo (o ausente)", () => {
  expect(parseCommentBody({ ...OK_BODY, timestampRef: 75 })).toMatchObject({ ok: true, data: { timestampRef: 75 } });
  expect(parseCommentBody({ ...OK_BODY, timestampRef: 0 })).toMatchObject({ ok: true, data: { timestampRef: 0 } });
  expect(parseCommentBody({ ...OK_BODY, timestampRef: null })).toMatchObject({ ok: true, data: { timestampRef: null } });
  expect(parseCommentBody({ ...OK_BODY, timestampRef: -1 }).ok).toBe(false);
  expect(parseCommentBody({ ...OK_BODY, timestampRef: 1.5 }).ok).toBe(false);
  expect(parseCommentBody({ ...OK_BODY, timestampRef: "75" }).ok).toBe(false);
  expect(parseCommentBody({ ...OK_BODY, timestampRef: Number.POSITIVE_INFINITY }).ok).toBe(false);
});

test("parentId debe ser un entero positivo (o ausente)", () => {
  expect(parseCommentBody({ ...OK_BODY, parentId: 3 })).toMatchObject({ ok: true, data: { parentId: 3 } });
  expect(parseCommentBody({ ...OK_BODY, parentId: null })).toMatchObject({ ok: true, data: { parentId: null } });
  expect(parseCommentBody({ ...OK_BODY, parentId: 0 }).ok).toBe(false);
  expect(parseCommentBody({ ...OK_BODY, parentId: "3" }).ok).toBe(false);
  expect(parseCommentBody({ ...OK_BODY, parentId: 2.5 }).ok).toBe(false);
});

test("una respuesta ignora el momento del vídeo (solo lo llevan los comentarios principales)", () => {
  const result = parseCommentBody({ ...OK_BODY, parentId: 3, timestampRef: 75 });
  expect(result).toMatchObject({ ok: true, data: { parentId: 3, timestampRef: null } });
});

const parent = (partial: Partial<ParentRow> = {}): ParentRow => ({ id: 3, pelicula_id: 7, parent_id: null, is_deleted: false, ...partial });

test("solo se puede responder a un comentario principal, vivo y de la misma obra", () => {
  expect(checkParent(parent(), 7)).toEqual({ ok: true });
});

test("rechaza responder a un comentario que no existe", () => {
  expect(checkParent(null, 7)).toEqual({ ok: false, reason: "not_found" });
});

test("rechaza responder a un comentario borrado", () => {
  expect(checkParent(parent({ is_deleted: true }), 7)).toEqual({ ok: false, reason: "deleted" });
});

test("rechaza responder a un comentario de otra obra", () => {
  expect(checkParent(parent({ pelicula_id: 9 }), 7)).toEqual({ ok: false, reason: "other_work" });
});

test("rechaza responder a una respuesta (los hilos tienen un solo nivel)", () => {
  expect(checkParent(parent({ parent_id: 1 }), 7)).toEqual({ ok: false, reason: "is_reply" });
});

interface Row {
  id: number;
  parent_id: number | null;
  like_count: number;
  created_at: string;
}
const row = (id: number, parent_id: number | null, like_count = 0, created_at = `2026-10-0${id}T10:00:00Z`): Row => ({ id, parent_id, like_count, created_at });

test("agrupa las respuestas bajo su comentario, de más antigua a más nueva", () => {
  const threads = groupThreads([row(1, null), row(4, 1), row(3, 1), row(2, null)]);
  const first = threads.find((t) => t.id === 1)!;
  expect(first.replies.map((r) => r.id)).toEqual([3, 4]);
  expect(threads.find((t) => t.id === 2)!.replies).toEqual([]);
});

test("ordena los comentarios principales por «me gusta» y, a igualdad, por los más recientes", () => {
  const threads = groupThreads([row(1, null, 0), row(2, null, 5), row(3, null, 0)]);
  expect(threads.map((t) => t.id)).toEqual([2, 3, 1]);
});

test("una respuesta cuyo padre no está (borrado o inexistente) no aparece en ningún hilo", () => {
  const threads = groupThreads([row(1, null), row(5, 99), row(6, 5)]);
  expect(threads.map((t) => t.id)).toEqual([1]);
  expect(threads[0]!.replies).toEqual([]);
});

test("el contador suma comentarios y respuestas", () => {
  const threads = groupThreads([row(1, null), row(2, 1), row(3, 1), row(4, null)]);
  expect(countComments(threads)).toBe(4);
  expect(countComments([])).toBe(0);
});

test("explica cada error de publicación con un mensaje claro", () => {
  expect(commentErrorMessage(429, null)).toContain("demasiado rápido");
  expect(commentErrorMessage(404, "parent_invalid")).toContain("no se puede responder");
  expect(commentErrorMessage(400, "parent_invalid")).toContain("no se puede responder");
  expect(commentErrorMessage(400, "timestamp_out_of_range")).toContain("momento");
  expect(commentErrorMessage(400, "invalid_input")).toContain("No se pudo publicar");
  expect(commentErrorMessage(404, "work_not_found")).toContain("No se pudo publicar");
  expect(commentErrorMessage(500, "server_error")).toContain("No se pudo publicar");
  expect(commentErrorMessage(500, null)).toContain("No se pudo publicar");
});

test("sustituye nombre, foto, icono y color de cada comentario por los de su autor resuelto", () => {
  const rows = [
    { id: 1, user_id: "u1", profile_id: "", display_name: "Guardado 1", avatar_color: null },
    { id: 2, user_id: "u1", profile_id: "p_2", display_name: "Guardado 2", avatar_color: "#FFD600" },
    { id: 3, user_id: "u3", profile_id: null, display_name: "Guardado 3", avatar_color: "#123456" },
  ];
  const authors = {
    [authorKey("u1", "")]: { displayName: "Ana", avatarUrl: "https://lh3.googleusercontent.com/a/ana", avatarIconId: null, avatarColor: "#22B16B" },
    [authorKey("u1", "p_2")]: { displayName: "Perfil 2", avatarUrl: null, avatarIconId: "cat", avatarColor: "purple" },
  };
  const result = attachAuthors(rows, authors);
  expect(result[0]).toMatchObject({ id: 1, display_name: "Ana", avatar_url: "https://lh3.googleusercontent.com/a/ana", avatar_icon_id: null, avatar_color: "#22B16B" });
  expect(result[1]).toMatchObject({ id: 2, display_name: "Perfil 2", avatar_url: null, avatar_icon_id: "cat", avatar_color: "purple" });
  // autor sin perfil resuelto: se conservan el nombre y el color guardados en el comentario, sin foto
  expect(result[2]).toMatchObject({ id: 3, display_name: "Guardado 3", avatar_url: null, avatar_icon_id: null, avatar_color: "#123456" });
});

test("no modifica la lista original", () => {
  const rows = [{ id: 1, user_id: "u1", profile_id: "", display_name: "Guardado", avatar_color: null }];
  attachAuthors(rows, { [authorKey("u1", "")]: { displayName: "Ana", avatarUrl: null, avatarIconId: null, avatarColor: null } });
  expect(rows[0]).toEqual({ id: 1, user_id: "u1", profile_id: "", display_name: "Guardado", avatar_color: null });
});

test("el perfil con el que se comenta es opcional (por defecto, el principal)", () => {
  expect(parseCommentBody(OK_BODY)).toMatchObject({ ok: true, data: { profileId: "" } });
  expect(parseCommentBody({ ...OK_BODY, profileId: "" })).toMatchObject({ ok: true, data: { profileId: "" } });
  expect(parseCommentBody({ ...OK_BODY, profileId: "p_123_abc" })).toMatchObject({ ok: true, data: { profileId: "p_123_abc" } });
  expect(parseCommentBody({ ...OK_BODY, profileId: null })).toMatchObject({ ok: true, data: { profileId: "" } });
});

test("rechaza un perfil con tipo incorrecto o demasiado largo", () => {
  expect(parseCommentBody({ ...OK_BODY, profileId: 5 }).ok).toBe(false);
  expect(parseCommentBody({ ...OK_BODY, profileId: {} }).ok).toBe(false);
  expect(parseCommentBody({ ...OK_BODY, profileId: "p".repeat(65) }).ok).toBe(false);
});

test("editar un comentario: id y texto nuevo válidos", () => {
  expect(parseCommentPatch({ commentId: 4, content: "  Texto corregido  " })).toEqual({
    ok: true,
    data: { kind: "edit", commentId: 4, content: "Texto corregido" },
  });
  expect(parseCommentPatch({ commentId: 4, content: "a".repeat(1500) })).toMatchObject({ ok: true, data: { kind: "edit" } });
  expect(parseCommentPatch({ commentId: 4, content: "   " }).ok).toBe(false);
  expect(parseCommentPatch({ commentId: 4, content: 5 }).ok).toBe(false);
  expect(parseCommentPatch({ commentId: 0, content: "x" }).ok).toBe(false);
  expect(parseCommentPatch({ commentId: "4", content: "x" }).ok).toBe(false);
});

test("acciones del creador: fijar, quitar fijado, corazón y quitar corazón", () => {
  for (const action of ["pin", "unpin", "heart", "unheart"] as const) {
    expect(parseCommentPatch({ commentId: 9, action })).toEqual({ ok: true, data: { kind: "action", commentId: 9, action } });
  }
  expect(parseCommentPatch({ commentId: 9, action: "borrar-todo" }).ok).toBe(false);
  expect(parseCommentPatch({ commentId: 9, action: 3 }).ok).toBe(false);
});

test("un parche necesita texto o una acción, pero no ambos, y un cuerpo válido", () => {
  expect(parseCommentPatch({ commentId: 9 }).ok).toBe(false);
  expect(parseCommentPatch({ commentId: 9, content: "x", action: "pin" }).ok).toBe(false);
  expect(parseCommentPatch(null).ok).toBe(false);
  expect(parseCommentPatch([]).ok).toBe(false);
});

test("marca los comentarios del creador del título", () => {
  const rows = [{ id: 1, user_id: "creador" }, { id: 2, user_id: "otro" }];
  expect(flagCreator(rows, "creador").map((r) => r.is_creator)).toEqual([true, false]);
  expect(flagCreator(rows, null).map((r) => r.is_creator)).toEqual([false, false]);
  expect(rows[0]).toEqual({ id: 1, user_id: "creador" }); // no modifica la lista original
});

test("las acciones del creador solo valen en comentarios principales de su obra", () => {
  const top = { pelicula_id: 7, parent_id: null as number | null, is_deleted: false };
  expect(canCreatorAct(top, 7, "pin")).toBe(true);
  expect(canCreatorAct(top, 7, "heart")).toBe(true);
  expect(canCreatorAct({ ...top, parent_id: 3 }, 7, "pin")).toBe(false); // no se fija una respuesta
  expect(canCreatorAct({ ...top, parent_id: 3 }, 7, "heart")).toBe(true); // sí se puede dar corazón a una respuesta
  expect(canCreatorAct({ ...top, pelicula_id: 8 }, 7, "heart")).toBe(false);
  expect(canCreatorAct({ ...top, is_deleted: true }, 7, "heart")).toBe(false);
});

// ── Mención por referencia (no por nombre) ────────────────────────────────────

test("una respuesta puede indicar a qué comentario del hilo responde", () => {
  const result = parseCommentBody({ ...OK_BODY, parentId: 4, replyToId: 9 });
  expect(result.ok && result.data.replyToId).toBe(9);
  expect(result.ok && result.data.parentId).toBe(4);
});

test("sin replyToId la respuesta no menciona a nadie", () => {
  const result = parseCommentBody({ ...OK_BODY, parentId: 4 });
  expect(result.ok && result.data.replyToId).toBeNull();
  const explicit = parseCommentBody({ ...OK_BODY, parentId: 4, replyToId: null });
  expect(explicit.ok && explicit.data.replyToId).toBeNull();
});

test("replyToId solo vale en respuestas y debe ser un entero positivo", () => {
  expect(parseCommentBody({ ...OK_BODY, replyToId: 9 }).ok).toBe(false); // un comentario principal no responde a nadie
  for (const bad of [0, -1, 1.5, "9", true, {}, []]) {
    expect(parseCommentBody({ ...OK_BODY, parentId: 4, replyToId: bad }).ok).toBe(false);
  }
});

const TARGET = { id: 9, pelicula_id: 7, parent_id: 4 as number | null, is_deleted: false };

test("se puede responder al comentario principal del hilo o a una respuesta de ese mismo hilo", () => {
  expect(checkReplyTarget({ ...TARGET, id: 4, parent_id: null }, 4, 7)).toEqual({ ok: true });
  expect(checkReplyTarget(TARGET, 4, 7)).toEqual({ ok: true });
});

test("no se puede mencionar a un comentario inexistente, borrado, de otra obra o de otro hilo", () => {
  expect(checkReplyTarget(null, 4, 7)).toEqual({ ok: false, reason: "not_found" });
  expect(checkReplyTarget({ ...TARGET, is_deleted: true }, 4, 7)).toEqual({ ok: false, reason: "deleted" });
  expect(checkReplyTarget({ ...TARGET, pelicula_id: 8 }, 4, 7)).toEqual({ ok: false, reason: "other_work" });
  expect(checkReplyTarget({ ...TARGET, parent_id: 5 }, 4, 7)).toEqual({ ok: false, reason: "other_thread" });
  expect(checkReplyTarget({ ...TARGET, id: 5, parent_id: null }, 4, 7)).toEqual({ ok: false, reason: "other_thread" });
});

test("el mensaje de error de un comentario respondido que ya no existe es claro", () => {
  expect(commentErrorMessage(404, "reply_target_invalid")).toContain("no se puede responder");
  expect(commentErrorMessage(400, "reply_target_invalid")).toContain("no se puede responder");
});

test.describe("attachReplyTargets (el nombre mencionado es siempre el actual)", () => {
  const rows = [
    { id: 1, parent_id: null, display_name: "Bea", reply_to_id: null },
    { id: 2, parent_id: 1, display_name: "Carlos", reply_to_id: 1 },
    { id: 3, parent_id: 1, display_name: "Dani", reply_to_id: 2 },
  ];

  test("la mención toma el nombre actual del autor respondido, aunque lo haya cambiado", () => {
    // «Bea» antes se llamaba «Ana»: el nombre sale de display_name ya resuelto, nunca del texto del comentario.
    const result = attachReplyTargets(rows);
    expect(result.find((r) => r.id === 2)?.reply_to_name).toBe("Bea");
    expect(result.find((r) => r.id === 3)?.reply_to_name).toBe("Carlos");
  });

  test("sin mención, reply_to_name es null", () => {
    expect(attachReplyTargets(rows).find((r) => r.id === 1)?.reply_to_name).toBeNull();
  });

  test("si el comentario respondido ya no está visible (borrado), el nombre es null pero se conserva el id", () => {
    const result = attachReplyTargets([{ id: 5, parent_id: 1, display_name: "Eva", reply_to_id: 99 }]);
    expect(result[0]?.reply_to_name).toBeNull();
    expect(result[0]?.reply_to_id).toBe(99);
  });

  test("dos perfiles con el mismo nombre no se confunden: cada mención apunta a su comentario", () => {
    const same = [
      { id: 1, parent_id: null, display_name: "Ana", reply_to_id: null },
      { id: 2, parent_id: 1, display_name: "Ana", reply_to_id: null },
      { id: 3, parent_id: 1, display_name: "Zoe", reply_to_id: 2 },
    ];
    const mention = attachReplyTargets(same).find((r) => r.id === 3);
    expect(mention?.reply_to_id).toBe(2);
    expect(mention?.reply_to_name).toBe("Ana");
  });

  test("no modifica la lista original", () => {
    const copy = JSON.stringify(rows);
    attachReplyTargets(rows);
    expect(JSON.stringify(rows)).toBe(copy);
  });
});
