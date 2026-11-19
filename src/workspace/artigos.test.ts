import { describe, expect, test } from "bun:test";
import { CHAVE_WORKSPACE, carregarWorkspace, salvarWorkspace, type Armazenamento, type EstadoWorkspace } from "./armazenamento";
import {
  abrirArtigo,
  artigoAtivo,
  ativarNoDispositivo,
  CHAVE_ARTIGOS,
  carregarBiblioteca,
  criarArtigo,
  estadoVazio,
  LIMITE_ARTIGOS,
  limparDispositivo,
  porRecencia,
  removerArtigo,
  salvarBiblioteca,
  tituloDoArtigo,
  validarBiblioteca,
  type Biblioteca,
} from "./artigos";

function storageFalso(): Armazenamento & { mapa: Map<string, string> } {
  const mapa = new Map<string, string>();
  return {
    mapa,
    getItem: (k) => mapa.get(k) ?? null,
    setItem: (k, v) => mapa.set(k, v),
    removeItem: (k) => mapa.delete(k),
  };
}

const texto = (bruto: string, arquivo: string | null = null): EstadoWorkspace => ({ ...estadoVazio(), bruto, arquivo });

/** Biblioteca com os artigos dados, o primeiro aberto, datas crescentes. */
function biblioteca(...brutos: string[]): Biblioteca {
  const artigos = brutos.map((b, i) => ({ id: `a${i + 1}`, atualizadoEm: i + 1, estado: texto(b) }));
  return { ativo: "a1", artigos };
}

describe("workspace/artigos — limite e troca", () => {
  test("cria até o limite e recusa o próximo, sem apagar nada", () => {
    let b = biblioteca("Primeiro.");
    for (let i = b.artigos.length; i < LIMITE_ARTIGOS; i++) b = criarArtigo(b, texto(`Artigo ${i + 1}.`), 100 + i)!;
    expect(b.artigos).toHaveLength(LIMITE_ARTIGOS);
    expect(criarArtigo(b, texto("Quarto."))).toBeNull();
  });

  test("o artigo criado já fica aberto", () => {
    const b = criarArtigo(biblioteca("Primeiro."), texto("Segundo."), 50)!;
    expect(artigoAtivo(b).estado.bruto).toBe("Segundo.");
  });

  test("abrir troca o artigo aberto; id desconhecido não muda nada", () => {
    const b = biblioteca("Um.", "Dois.");
    expect(artigoAtivo(abrirArtigo(b, "a2")).estado.bruto).toBe("Dois.");
    expect(abrirArtigo(b, "nao-existe")).toBe(b);
  });

  test("excluir o aberto abre o mais recente dos que sobram", () => {
    const b = { ...biblioteca("Um.", "Dois.", "Três."), ativo: "a1" };
    const r = removerArtigo(b, "a1");
    expect(r.artigos.map((a) => a.id)).toEqual(["a2", "a3"]);
    expect(r.ativo).toBe("a3");
  });

  test("excluir outro mantém o aberto; excluir o último começa um vazio", () => {
    expect(removerArtigo(biblioteca("Um.", "Dois."), "a2").ativo).toBe("a1");
    const r = removerArtigo(biblioteca("Único."), "a1");
    expect(r.artigos).toHaveLength(1);
    expect(artigoAtivo(r).estado.bruto).toBe("");
  });

  test("lista do mais recente para o mais antigo", () => {
    expect(porRecencia(biblioteca("Um.", "Dois.", "Três.")).map((a) => a.id)).toEqual(["a3", "a2", "a1"]);
  });
});

describe("workspace/artigos — título", () => {
  test("usa o nome do arquivo sem extensão", () => {
    expect(tituloDoArtigo(texto("Qualquer texto.", "Artigo final.docx"))).toBe("Artigo final");
  });

  test("sem arquivo, usa a primeira linha com texto, encurtada", () => {
    expect(tituloDoArtigo(texto("\n\n  INTRODUÇÃO  \n\nCorpo."))).toBe("INTRODUÇÃO");
    expect(tituloDoArtigo(texto("x".repeat(100)), 10)).toBe("xxxxxxxxx…");
  });

  test("vazio vira 'Artigo sem título'", () => {
    expect(tituloDoArtigo(texto("   "))).toBe("Artigo sem título");
  });
});

describe("workspace/artigos — dispositivo", () => {
  test("trabalho salvo antes desta versão vira o primeiro artigo", () => {
    const st = storageFalso();
    salvarWorkspace(texto("Trabalho antigo."), st);
    const b = carregarBiblioteca(st);
    expect(b.artigos).toHaveLength(1);
    expect(artigoAtivo(b).estado.bruto).toBe("Trabalho antigo.");
  });

  test("sem nada salvo, começa com um artigo vazio aberto", () => {
    const b = carregarBiblioteca(storageFalso());
    expect(b.artigos).toHaveLength(1);
    expect(artigoAtivo(b).estado.bruto).toBe("");
  });

  test("o que o editor salvou por último prevalece sobre a cópia da biblioteca", () => {
    const st = storageFalso();
    salvarBiblioteca(biblioteca("Versão antiga.", "Outro."), st);
    salvarWorkspace(texto("Versão nova, digitada agora."), st);
    const b = carregarBiblioteca(st, 999);
    expect(artigoAtivo(b).estado.bruto).toBe("Versão nova, digitada agora.");
    expect(artigoAtivo(b).atualizadoEm).toBe(999);
    expect(b.artigos.find((a) => a.id === "a2")?.estado.bruto).toBe("Outro.");
  });

  test("ativar põe o artigo escolhido no editor", () => {
    const st = storageFalso();
    ativarNoDispositivo(abrirArtigo(biblioteca("Um.", "Dois."), "a2"), st);
    expect(carregarWorkspace(st)?.bruto).toBe("Dois.");
    expect(artigoAtivo(carregarBiblioteca(st)).id).toBe("a2");
  });

  test("sair limpa os artigos e o editor do dispositivo", () => {
    const st = storageFalso();
    ativarNoDispositivo(biblioteca("Um."), st);
    limparDispositivo(st);
    expect(st.mapa.has(CHAVE_ARTIGOS)).toBe(false);
    expect(st.mapa.has(CHAVE_WORKSPACE)).toBe(false);
  });

  test("dado corrompido ou malformado não derruba: entradas inválidas são descartadas", () => {
    const st = storageFalso();
    st.setItem(CHAVE_ARTIGOS, "{quebrado");
    expect(carregarBiblioteca(st).artigos).toHaveLength(1);

    const valida = validarBiblioteca({
      ativo: "nao-existe",
      artigos: [{ id: "a1", atualizadoEm: 1, estado: texto("Bom.") }, { id: 7, estado: texto("x") }, "lixo"],
    });
    expect(valida?.artigos.map((a) => a.id)).toEqual(["a1"]);
    expect(valida?.ativo).toBe("a1");
    expect(validarBiblioteca({ artigos: [] })).toBeNull();
  });
});
