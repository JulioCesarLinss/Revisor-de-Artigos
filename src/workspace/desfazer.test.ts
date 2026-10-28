import { describe, expect, test } from "bun:test";
import { desempilhar, empilhar, LIMITE_DESFAZER } from "./desfazer";

describe("workspace/desfazer", () => {
  test("desfaz na ordem inversa das alterações", () => {
    let pilha: string[] = [];
    pilha = empilhar(pilha, "v1");
    pilha = empilhar(pilha, "v2");
    const a = desempilhar(pilha);
    expect(a?.texto).toBe("v2");
    const b = desempilhar(a!.pilha);
    expect(b?.texto).toBe("v1");
    expect(desempilhar(b!.pilha)).toBeNull();
  });

  test("não repete o mesmo estado seguido", () => {
    expect(empilhar(["v1"], "v1")).toEqual(["v1"]);
  });

  test("guarda no máximo o limite, descartando os mais antigos", () => {
    let pilha: string[] = [];
    for (let i = 1; i <= LIMITE_DESFAZER + 5; i++) pilha = empilhar(pilha, `v${i}`);
    expect(pilha.length).toBe(LIMITE_DESFAZER);
    expect(pilha[0]).toBe("v6");
    expect(pilha[pilha.length - 1]).toBe(`v${LIMITE_DESFAZER + 5}`);
  });
});
