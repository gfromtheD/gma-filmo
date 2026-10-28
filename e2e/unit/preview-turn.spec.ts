import { test, expect } from "@playwright/test";
import { usePreviewTurnStore } from "../../store/use-preview-turn-store";

test.describe("turno de las vistas previas", () => {
  test.beforeEach(() => usePreviewTurnStore.setState({ holder: null }));

  test("la tarjeta que se abre toma el turno y al cerrarse lo devuelve al hero", () => {
    const { claim, release } = usePreviewTurnStore.getState();
    claim("tarjeta-a");
    expect(usePreviewTurnStore.getState().holder).toBe("tarjeta-a");
    release("tarjeta-a");
    expect(usePreviewTurnStore.getState().holder).toBeNull();
  });

  test("manda el último gesto: una tarjeta que se cierra tarde no quita el turno a la siguiente", () => {
    const { claim, release } = usePreviewTurnStore.getState();
    claim("tarjeta-a");
    claim("tarjeta-b");
    release("tarjeta-a");
    expect(usePreviewTurnStore.getState().holder).toBe("tarjeta-b");
  });
});
