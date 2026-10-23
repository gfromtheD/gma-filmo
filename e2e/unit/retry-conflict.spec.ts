import { test, expect } from "@playwright/test";
import { CONCURRENCY_LIMIT, RATE_LIMITED, REVISION_CONFLICT, retryOnRevisionConflict, retryWhileBusy } from "../../lib/uploads/retry-conflict";

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

test.describe("retryWhileBusy", () => {
  test("espera turno mientras el servidor dice que hay demasiadas subidas y acaba entrando", async () => {
    let calls = 0;
    const waits: number[] = [];
    const result = await retryWhileBusy(async () => { calls++; if (calls < 4) throw new Error(CONCURRENCY_LIMIT); return "dentro"; },
      { intervalMs: 10, sleep: async (ms) => { waits.push(ms); } });
    expect(result).toBe("dentro");
    expect(calls).toBe(4);
    expect(waits).toHaveLength(3);
  });

  test("se rinde si el turno no llega en el tiempo máximo", async () => {
    let calls = 0;
    await expect(retryWhileBusy(async () => { calls++; throw new Error(CONCURRENCY_LIMIT); }, { maxWaitMs: 30, intervalMs: 10, sleep: async () => undefined }))
      .rejects.toThrow(CONCURRENCY_LIMIT);
    expect(calls).toBe(4);
  });

  test("otros errores no esperan", async () => {
    let calls = 0;
    await expect(retryWhileBusy(async () => { calls++; throw new Error("UPLOAD_QUOTA_EXCEEDED"); }, { sleep: async () => undefined })).rejects.toThrow("UPLOAD_QUOTA_EXCEEDED");
    expect(calls).toBe(1);
  });
});

test.describe("retryWhileBusy con el freno de reservas", () => {
  test("si salta el tope por minuto, espera y vuelve a intentarlo", async () => {
    let calls = 0;
    const result = await retryWhileBusy(async () => { calls++; if (calls < 3) throw new Error(RATE_LIMITED); return "dentro"; },
      { intervalMs: 10, sleep: async () => undefined });
    expect(result).toBe("dentro");
    expect(calls).toBe(3);
  });
});
