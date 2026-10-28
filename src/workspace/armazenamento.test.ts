import { describe, expect, test } from "bun:test";
import {
  carregarWorkspace,
  CHAVE_WORKSPACE,
  contarPorOrigem,
  limparHistoricoWorkspace,
  limparWorkspace,
  restaurarOriginalWorkspace,
  salvarWorkspace,
  validarWorkspace,
  type Armazenamento,
  type EstadoWorkspace,
} from "./armazenamento";
import { registrar } from "./historico";

/** Storage em memória (mesma interface do localStorage) para os testes. */
function storageFalso(): Armazenamento & { mapa: Map<string, string> } {
  const mapa = new Map<string, string>();
  return {
    mapa,
    getItem: (k) => mapa.get(k) ?? null,
    setItem: (k, v) => mapa.set(k, v),
    removeItem: (k) => mapa.delete(k),
  };
}

const WORKSPACE: EstadoWorkspace = {
  bruto: "Parágrafo um.\n\nParágrafo dois.",
  textoOriginal: "Parágrafo um.\n\nParágrafo dois.",
  historico: [
    { id: 1, origem: "manual", descricao: "correção rápida aplicada", paragrafo: 1, quando: "10:00:00" },
    { id: 2, origem: "ia", descricao: "sugestão aceita (R001)", paragrafo: 2, quando: "10:05:00" },
  ],
  feedbacks: { 1: true },
};

describe("workspace/armazenamento — persistência", () => {
  test("salva e recarrega o workspace completo", () => {
    const st = storageFalso();
    salvarWorkspace(WORKSPACE, st);
    const carregado = carregarWorkspace(st);
    expect(carregado).not.toBeNull();
    expect(carregado?.bruto).toBe(WORKSPACE.bruto);
    expect(carregado?.historico.length).toBe(2);
    expect(carregado?.feedbacks[1]).toBe(true);
  });

  test("dados antigos com etapas e versões ainda carregam, sem esses campos", () => {
    const st = storageFalso();
    st.setItem(
      CHAVE_WORKSPACE,
      JSON.stringify({
        ...WORKSPACE,
        versoes: [{ id: 1, estado: "rascunho", bruto: "cópia pesada", totalProblemas: 3, quando: "10:01:00" }],
        estadoFluxo: "revisao",
      }),
    );
    const carregado = carregarWorkspace(st);
    expect(carregado?.bruto).toBe(WORKSPACE.bruto);
    expect(carregado?.historico.length).toBe(2);
    expect(carregado && "versoes" in carregado).toBe(false);
    expect(carregado && "estadoFluxo" in carregado).toBe(false);
  });

  test("ausente ou JSON corrompido devolve null, nunca lança", () => {
    const st = storageFalso();
    expect(carregarWorkspace(st)).toBeNull();
    st.setItem(CHAVE_WORKSPACE, "{quebrado");
    expect(carregarWorkspace(st)).toBeNull();
  });

  test("validação rejeita formas inválidas e descarta entradas malformadas", () => {
    expect(validarWorkspace(null)).toBeNull();
    expect(validarWorkspace("texto")).toBeNull();
    expect(validarWorkspace({ ...WORKSPACE, bruto: 42 })).toBeNull();
    expect(validarWorkspace({ ...WORKSPACE, historico: "não é lista" })).toBeNull();

    const parcial = validarWorkspace({
      ...WORKSPACE,
      historico: [WORKSPACE.historico[0], { id: 9, origem: "desconhecida" }, "lixo"],
      feedbacks: { 1: true, abc: true, 2: "sim" },
    });
    expect(parcial?.historico.length).toBe(1); // só o registro válido
    expect(parcial?.feedbacks).toEqual({ 1: true });
  });

  test("limparWorkspace descarta tudo; limparHistorico preserva o manuscrito", () => {
    const st = storageFalso();
    salvarWorkspace(WORKSPACE, st);

    const limpo = limparHistoricoWorkspace(st);
    expect(limpo?.bruto).toBe(WORKSPACE.bruto);
    expect(limpo?.historico).toEqual([]);
    expect(limpo?.feedbacks).toEqual({});
    expect(carregarWorkspace(st)?.bruto).toBe(WORKSPACE.bruto);

    limparWorkspace(st);
    expect(carregarWorkspace(st)).toBeNull();
    expect(st.mapa.has(CHAVE_WORKSPACE)).toBe(false);
  });

  test("textoOriginal é salvo e recarregado junto do workspace", () => {
    const st = storageFalso();
    salvarWorkspace({ ...WORKSPACE, textoOriginal: "TEXTO DO ARQUIVO\n\nPUBLICADO." }, st);
    const carregado = carregarWorkspace(st);
    expect(carregado?.textoOriginal).toBe("TEXTO DO ARQUIVO\n\nPUBLICADO.");
  });

  test("restaurarOriginalWorkspace volta ao texto do arquivo e zera o rastro", () => {
    const st = storageFalso();
    salvarWorkspace({ ...WORKSPACE, bruto: "Texto editado depois." }, st);

    const restaurado = restaurarOriginalWorkspace(st);
    expect(restaurado?.bruto).toBe(WORKSPACE.textoOriginal!);
    expect(restaurado?.textoOriginal).toBe(WORKSPACE.textoOriginal!);
    expect(restaurado?.historico).toEqual([]);
    expect(restaurado?.feedbacks).toEqual({});
    // Persistido: ao recarregar, continua restaurado.
    expect(carregarWorkspace(st)?.bruto).toBe(WORKSPACE.textoOriginal!);
  });

  test("restaurarOriginalWorkspace devolve null quando não há arquivo original", () => {
    const st = storageFalso();
    salvarWorkspace({ ...WORKSPACE, bruto: "Texto atual.", textoOriginal: null }, st);
    expect(restaurarOriginalWorkspace(st)).toBeNull();
    expect(carregarWorkspace(st)?.bruto).toBe("Texto atual."); // nada mudou
  });

  test("contarPorOrigem separa manual × IA", () => {
    const c = contarPorOrigem(WORKSPACE.historico);
    expect(c).toEqual({ manual: 1, ia: 1, total: 2 });
    expect(contarPorOrigem([])).toEqual({ manual: 0, ia: 0, total: 0 });
  });
});

describe("workspace/armazenamento — ids após restauração", () => {
  test("registrar não colide com ids restaurados do storage", () => {
    const restaurado = WORKSPACE.historico; // ids 1 e 2 vindos do storage
    const h = registrar(restaurado, { origem: "manual", descricao: "nova correção", paragrafo: 1 });
    // Ids restaurados preservados e o novo é maior que todos (sem duplicatas),
    // independentemente do contador global compartilhado entre testes.
    expect(h.slice(0, -1).map((e) => e.id)).toEqual(restaurado.map((e) => e.id));
    expect(h[h.length - 1].id).toBeGreaterThan(restaurado[restaurado.length - 1].id);
    expect(new Set(h.map((e) => e.id)).size).toBe(h.length); // sem duplicatas
  });
});
