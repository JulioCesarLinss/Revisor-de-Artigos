import { describe, expect, test } from "bun:test";
import {
  carregarConfigIA,
  carregarPerfil,
  CHAVE_CONFIG_IA,
  CHAVE_PERFIL,
  iniciaisDoNome,
  removerConfigIA,
  rotuloDoPerfil,
  salvarConfigIA,
  salvarPerfil,
  validarPerfil,
  type Armazenamento,
} from "./perfil";

/** Storage em memória para os testes (mesma interface do localStorage). */
function storageFalso(): Armazenamento & { mapa: Map<string, string> } {
  const mapa = new Map<string, string>();
  return {
    mapa,
    getItem: (k) => mapa.get(k) ?? null,
    setItem: (k, v) => mapa.set(k, v),
    removeItem: (k) => mapa.delete(k),
  };
}

describe("perfil/perfil — persistência local", () => {
  test("salva e recarrega o perfil com todas as os campos", () => {
    const st = storageFalso();
    salvarPerfil({ nome: "Marcelo Silva", email: "marcelo@ufrj.br", instituicao: "UFRJ", perfil: "docente" }, st);
    const carregado = carregarPerfil(st);
    expect(carregado).not.toBeNull();
    expect(carregado?.nome).toBe("Marcelo Silva");
    expect(carregado?.perfil).toBe("docente");
  });

  test("perfil ausente ou corrompido devolve null, nunca quebra", () => {
    const st = storageFalso();
    expect(carregarPerfil(st)).toBeNull();
    st.setItem(CHAVE_PERFIL, "{json quebrado");
    expect(carregarPerfil(st)).toBeNull();
  });

  test("validarPerfil exige nome e e-mail e normaliza espaços", () => {
    expect(validarPerfil({ nome: "  ", email: "a@b.br" })).toBeNull();
    expect(validarPerfil({ nome: "Ana", email: "" })).toBeNull();
    const ok = validarPerfil({ nome: " Ana Costa ", email: " ana@usp.br " });
    expect(ok?.nome).toBe("Ana Costa");
    expect(ok?.email).toBe("ana@usp.br");
    expect(ok?.perfil).toBe("graduacao"); // default
  });

  test("config IA: salva, recarrega com defaults opcionais e remove", () => {
    const st = storageFalso();
    expect(carregarConfigIA(st)).toBeNull();

    salvarConfigIA({ apiKey: "sk-teste" }, st);
    const config = carregarConfigIA(st);
    expect(config?.apiKey).toBe("sk-teste");
    expect(config?.baseUrl).toBeUndefined();
    expect(config?.modelo).toBeUndefined();

    salvarConfigIA({ apiKey: "sk-2", baseUrl: " https://api.local/v1 ", modelo: "gpt-4o-mini" }, st);
    const config2 = carregarConfigIA(st);
    expect(config2?.baseUrl).toBe("https://api.local/v1");
    expect(config2?.modelo).toBe("gpt-4o-mini");

    removerConfigIA(st);
    expect(st.mapa.has(CHAVE_CONFIG_IA)).toBe(false);
    expect(carregarConfigIA(st)).toBeNull();
  });

  test("chave vazia na configuração salva é tratada como não configurada", () => {
    const st = storageFalso();
    st.setItem(CHAVE_CONFIG_IA, JSON.stringify({ apiKey: "   " }));
    expect(carregarConfigIA(st)).toBeNull();
  });
});

describe("perfil/perfil — apresentação", () => {
  test("rótulo do perfil desconhecido cai no valor cru", () => {
    expect(rotuloDoPerfil("docente")).toBe("Docente / Orientador Acadêmico");
    expect(rotuloDoPerfil("xyz")).toBe("xyz");
  });

  test("iniciais usam primeiro nome + último sobrenome", () => {
    expect(iniciaisDoNome("Marcelo da Silva Junior")).toBe("MJ");
    expect(iniciaisDoNome("Ana")).toBe("A");
    expect(iniciaisDoNome("   ")).toBe("?");
  });
});
