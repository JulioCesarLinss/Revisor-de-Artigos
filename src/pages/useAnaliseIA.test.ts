import { describe, expect, test } from "bun:test";
import type { ResultadoDiagnostico } from "../ai/gemini";
import { analiseMaisRecente } from "./useAnaliseIA";

function analise(geradoEm: number | undefined, resumo: string): ResultadoDiagnostico {
  return { ok: true, resumo, diagnosticos: [], truncado: false, ...(geradoEm === undefined ? {} : { geradoEm }) };
}

describe("pages/useAnaliseIA — qual análise entra no resumo", () => {
  test("a mais recente das duas, para não contar o mesmo problema duas vezes", () => {
    expect(analiseMaisRecente(analise(100, "plataforma"), analise(200, "assistente"))).toEqual(analise(200, "assistente"));
    expect(analiseMaisRecente(analise(300, "plataforma"), analise(200, "assistente"))).toEqual(analise(300, "plataforma"));
  });

  test("só uma feita, ou falha na outra: vale a que deu certo", () => {
    const falha: ResultadoDiagnostico = { ok: false, motivo: "Erro." };
    expect(analiseMaisRecente(null, analise(1, "assistente"))).toEqual(analise(1, "assistente"));
    expect(analiseMaisRecente(analise(1, "plataforma"), falha)).toEqual(analise(1, "plataforma"));
    expect(analiseMaisRecente(null, falha)).toBeNull();
  });

  test("análise salva antes da data de geração conta como a mais antiga", () => {
    expect(analiseMaisRecente(analise(undefined, "antiga"), analise(5, "nova"))).toEqual(analise(5, "nova"));
  });
});
