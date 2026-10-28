import { afterEach, describe, expect, test } from "bun:test";
import { encerrarSessao, iniciarSessao, ouvirSessao, sessaoAtiva } from "./sessao";

afterEach(() => encerrarSessao());

describe("sessao — modo local avisa quem depende dela", () => {
  test("entrar e sair avisam os ouvintes na hora", () => {
    const recebidos: boolean[] = [];
    const cancelar = ouvirSessao((ativa) => recebidos.push(ativa));

    iniciarSessao(false);
    expect(sessaoAtiva()).toBe(true);
    encerrarSessao();
    expect(sessaoAtiva()).toBe(false);

    expect(recebidos).toEqual([true, false]);
    cancelar();
  });

  test("ouvinte cancelado não recebe mais avisos", () => {
    const recebidos: boolean[] = [];
    const cancelar = ouvirSessao((ativa) => recebidos.push(ativa));
    cancelar();
    iniciarSessao(true);
    expect(recebidos).toEqual([]);
  });
});
