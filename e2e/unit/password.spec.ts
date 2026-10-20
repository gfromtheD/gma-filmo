import { expect, test } from "@playwright/test";
import { MIN_PASSWORD_LENGTH, passwordErrorMessage, validateNewPassword } from "../../lib/auth/password";

test.describe("cambio de contraseña", () => {
  test("pide una longitud mínima", () => {
    expect(validateNewPassword("corta", "corta")).toMatch(String(MIN_PASSWORD_LENGTH));
  });

  test("las dos contraseñas tienen que coincidir", () => {
    expect(validateNewPassword("unaclavelarga", "otraclavelarga")).toBe("Las contraseñas no coinciden.");
  });

  test("una contraseña válida no da error", () => {
    expect(validateNewPassword("unaclavelarga", "unaclavelarga")).toBeNull();
  });

  test("traduce los errores conocidos de Supabase", () => {
    expect(passwordErrorMessage({ code: "same_password", message: "x" })).toBe("La nueva contraseña tiene que ser distinta de la actual.");
    expect(passwordErrorMessage({ code: "weak_password", message: "x" })).toMatch(/débil/);
    expect(passwordErrorMessage({ code: "invalid_credentials", message: "x" })).toBe("La contraseña actual no es correcta.");
    expect(passwordErrorMessage({ message: "algo raro" })).toBe("No se pudo cambiar la contraseña. Inténtalo de nuevo.");
  });
});
