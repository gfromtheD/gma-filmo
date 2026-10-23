import { expect, test } from "@playwright/test";
import { extraIndexOf, extraSlot, getAsset, setAsset, emptyDraft, type ExtraItem } from "../../lib/studio/upload-draft";
import { mapSlot } from "../../lib/studio-media/mapping";

const asset = (name: string) => ({ name, sizeBytes: 1, url: null, status: "uploading" as const });

test.describe("huecos de extras", () => {
  test("un extra con id conserva su hueco aunque se quite otro anterior", () => {
    const a: ExtraItem = { id: "a", kind: "video", file: null };
    const b: ExtraItem = { id: "b", kind: "fotograma", file: null };
    const draft = { ...emptyDraft(), extras: [a, b] };
    const slot = extraSlot(b, 1);
    expect(slot).toBe("extra:b");
    const withoutFirst = { ...draft, extras: [b] };
    expect(extraIndexOf(withoutFirst, slot)).toBe(0);
    expect(getAsset(setAsset(withoutFirst, slot, asset("foto.jpg")), slot)?.name).toBe("foto.jpg");
    expect(mapSlot(withoutFirst, slot)).toEqual({ supported: true, role: "extra_image" });
  });

  test("el hueco de un extra ya quitado no escribe en otro", () => {
    const draft = { ...emptyDraft(), extras: [{ id: "b", kind: "fotograma", file: null } as ExtraItem] };
    expect(extraIndexOf(draft, "extra:a")).toBe(-1);
    expect(setAsset(draft, "extra:a", asset("tarde.mp4")).extras[0]!.file).toBeNull();
  });

  test("los borradores antiguos (sin id) siguen usando la posición", () => {
    const draft = { ...emptyDraft(), extras: [{ kind: "video", file: null } as ExtraItem] };
    expect(extraSlot(draft.extras[0]!, 0)).toBe("extra:0");
    expect(extraIndexOf(draft, "extra:0")).toBe(0);
  });
});
