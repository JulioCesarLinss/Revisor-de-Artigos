import { describe, expect, test } from "bun:test";
import { apagarWorkspaceNuvem, carregarWorkspaceNuvem } from "./persistencia";

// Nos testes não há config VITE_FIREBASE_*: o módulo fica em modo local.
describe("firebase/persistencia — sem Firebase configurado", () => {
  test("apagarWorkspaceNuvem devolve false sem lançar", async () => {
    expect(await apagarWorkspaceNuvem("uid-qualquer")).toBe(false);
  });

  test("carregarWorkspaceNuvem devolve null sem lançar", async () => {
    expect(await carregarWorkspaceNuvem("uid-qualquer")).toBeNull();
  });
});
