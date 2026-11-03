import { expect, test } from "@playwright/test";
import { clearDraft, draftKey, DRAFT_STORAGE_KEY, loadDraft, saveDraft, type DraftStorage } from "../../lib/studio/draft-storage";
import { emptyDraft } from "../../lib/studio/upload-draft";

const memory = (): DraftStorage & { keys: () => string[] } => {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    keys: () => [...data.keys()],
  };
};

test.describe("borrador de la pasarela por cuenta", () => {
  test("cada cuenta guarda y lee el suyo, sin ver el de otra", () => {
    const storage = memory();
    saveDraft(storage, { ...emptyDraft(), title: "De Ana" }, "ana");
    saveDraft(storage, { ...emptyDraft(), title: "De Luis" }, "luis");
    expect(loadDraft(storage, "ana").title).toBe("De Ana");
    expect(loadDraft(storage, "luis").title).toBe("De Luis");
    expect(loadDraft(storage, "otra").title).toBe("");
  });

  test("borrar el de una cuenta no toca el de otra", () => {
    const storage = memory();
    saveDraft(storage, { ...emptyDraft(), title: "De Ana" }, "ana");
    saveDraft(storage, { ...emptyDraft(), title: "De Luis" }, "luis");
    clearDraft(storage, "ana");
    expect(loadDraft(storage, "ana").title).toBe("");
    expect(loadDraft(storage, "luis").title).toBe("De Luis");
  });

  test("la clave lleva la cuenta; sin cuenta se usa la común de siempre", () => {
    expect(draftKey("ana")).toBe(`${DRAFT_STORAGE_KEY}:ana`);
    expect(draftKey(null)).toBe(DRAFT_STORAGE_KEY);
    expect(draftKey()).toBe(DRAFT_STORAGE_KEY);
  });
});
