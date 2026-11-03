import { expect, test } from "@playwright/test";
import { groupReports, parseModerationBody, reportStatusFor, type ReportRow } from "../../lib/comments/moderation";

const row = (commentId: number, createdAt: string, patch: Partial<NonNullable<ReportRow["comments"]>> = {}): ReportRow => ({
  comment_id: commentId,
  created_at: createdAt,
  comments: { id: commentId, content: `comentario ${commentId}`, pelicula_id: 1, display_name: "@ana", is_deleted: false, ...patch },
});

test.describe("moderación ligera de comentarios", () => {
  test("valida el cuerpo: id entero positivo y una de las dos acciones", () => {
    expect(parseModerationBody({ commentId: 5, action: "hide" })).toEqual({ commentId: 5, action: "hide" });
    expect(parseModerationBody({ commentId: 5, action: "dismiss" })).toEqual({ commentId: 5, action: "dismiss" });
    for (const bad of [null, [], "x", { commentId: "5", action: "hide" }, { commentId: 0, action: "hide" }, { commentId: 1.5, action: "hide" }, { commentId: 5, action: "delete" }, { commentId: 5 }]) {
      expect(parseModerationBody(bad)).toBeNull();
    }
  });

  test("agrupa las denuncias por comentario: primero el más denunciado, y a igualdad el más reciente", () => {
    const items = groupReports([
      row(1, "2026-11-01T10:00:00Z"), row(2, "2026-11-02T10:00:00Z"), row(2, "2026-11-03T10:00:00Z"), row(3, "2026-11-04T10:00:00Z"),
    ]);
    expect(items.map((i) => i.commentId)).toEqual([2, 3, 1]);
    expect(items[0]).toMatchObject({ reportCount: 2, lastReportAt: "2026-11-03T10:00:00Z", authorName: "@ana" });
  });

  test("no cuenta comentarios ya ocultos ni denuncias sin comentario", () => {
    const items = groupReports([row(1, "2026-11-01T10:00:00Z", { is_deleted: true }), { comment_id: 9, created_at: "2026-11-01T10:00:00Z", comments: null }, row(2, "2026-11-01T10:00:00Z")]);
    expect(items.map((i) => i.commentId)).toEqual([2]);
  });

  test("descartar deja las denuncias como «dismissed»; ocultar, como «reviewed»", () => {
    expect(reportStatusFor("dismiss")).toBe("dismissed");
    expect(reportStatusFor("hide")).toBe("reviewed");
  });
});
