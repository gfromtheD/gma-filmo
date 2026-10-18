import { expect, test } from "@playwright/test";
import {
  COST_PER_EXTRA_GB_EUR, FREE_STORAGE_BYTES, FREE_STORAGE_GB, GIB, estimatePlan, formatBytes, storageLevel, suggestedPlanGB,
} from "../../lib/studio/storage-plan";

test.describe("plan de almacenamiento de los creadores", () => {
  test("5 GB gratis: no se cobra nada hasta pasar de ahí", () => {
    expect(FREE_STORAGE_GB).toBe(5);
    expect(estimatePlan(5)).toEqual({ totalGB: 5, extraGB: 0, storageEur: 0, feeEur: 0, totalEur: 0 });
    expect(estimatePlan(1).totalGB).toBe(5);
  });

  test("el coste por GB extra sale de lo que nos cuesta alojarlo (≈ 0,033 € al mes)", () => {
    expect(COST_PER_EXTRA_GB_EUR).toBeCloseTo(0.0331, 3);
    const plan = estimatePlan(50); // 45 GB extra
    expect(plan.extraGB).toBe(45);
    expect(plan.storageEur).toBeCloseTo(1.49, 2);
    expect(plan.feeEur).toBeCloseTo(0.27, 2); // 1,5 % + 0,25 €
    expect(plan.totalEur).toBeCloseTo(1.76, 2);
  });

  test("el total crece con el espacio y nunca pasa del máximo de la calculadora", () => {
    expect(estimatePlan(100).totalEur).toBeLessThan(estimatePlan(500).totalEur);
    expect(estimatePlan(9999).totalGB).toBe(500);
  });

  test("sugerencia: el siguiente tramo de 5 GB que deja caber lo que ya ocupa", () => {
    expect(suggestedPlanGB(2 * GIB)).toBe(5);
    expect(suggestedPlanGB(7.2 * GIB)).toBe(10);
    expect(suggestedPlanGB(12 * GIB)).toBe(15);
  });

  test("niveles de aviso de la barra", () => {
    expect(storageLevel(0)).toBe("ok");
    expect(storageLevel(FREE_STORAGE_BYTES * 0.8)).toBe("warning");
    expect(storageLevel(FREE_STORAGE_BYTES * 0.95)).toBe("critical");
    expect(storageLevel(FREE_STORAGE_BYTES * 1.1)).toBe("over");
  });

  test("formato corto de tamaños", () => {
    expect(formatBytes(1.25 * GIB)).toBe("1,3 GB");
    expect(formatBytes(340 * 1024 ** 2)).toBe("340 MB");
  });
});
