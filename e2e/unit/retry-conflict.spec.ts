import { test, expect } from "@playwright/test";
import { REVISION_CONFLICT, retryOnRevisionConflict } from "../../lib/uploads/retry-conflict";

const noWait = async () => undefined;

test.describe("retryOnRevisionConflict", () => {
  test("devuelve el resultado a la primera si no hay choque", async () => {
    let calls = 0;
    const result = await retryOnRevisionConflict(async () => { calls++; return "ok"; }, { sleep: noWait });
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  test("reintenta cuando otra subida reservó justo antes y acaba funcionando", async () => {
    let calls = 0;
    const result = await retryOnRevisionConflict(async () => {
      calls++;
      if (calls < 3) throw new Error(REVISION_CONFLICT);
      return "reservado";
    }, { sleep: noWait });
    expect(result).toBe("reservado");
    expect(calls).toBe(3);
  });

  test("se rinde tras agotar los intentos y propaga el choque", async () => {
    let calls = 0;
    await expect(retryOnRevisionConflict(async () => { calls++; throw new Error(REVISION_CONFLICT); }, { attempts: 3, sleep: noWait }))
      .rejects.toThrow(REVISION_CONFLICT);
    expect(calls).toBe(3);
  });

  test("no reintenta otros errores", async () => {
    let calls = 0;
    await expect(retryOnRevisionConflict(async () => { calls++; throw new Error("UPLOAD_SLOT_OCCUPIED"); }, { sleep: noWait }))
      .rejects.toThrow("UPLOAD_SLOT_OCCUPIED");
    expect(calls).toBe(1);
  });
});
