/**
 * Módulo `perfil` — dados do usuário persistidos no dispositivo
 * (localStorage): nome, e-mail e perfil de utilização.
 * O storage é injetável para os testes; o padrão é o localStorage real.
 */

export type Armazenamento = {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
};

export interface PerfilUsuario {
  nome: string;
  email: string;
  /** Valor de uma das opções de PERFIS (ex.: "graduacao"). */
  perfil: string;
}

export const PERFIS = [
  { valor: "graduacao", rotulo: "Graduação / TCC e Monografia" },
  { valor: "pos", rotulo: "Mestrado / Doutorado / Pós-Graduação" },
  { valor: "docente", rotulo: "Docente / Orientador Acadêmico" },
  { valor: "revisor", rotulo: "Comitê Editorial / Revisor de Periódico" },
] as const;

export const CHAVE_PERFIL = "normareview.perfil";

function armazenamentoPadrao(): Armazenamento | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Rótulo legível do perfil de utilização; devolve o valor cru se desconhecido. */
export function rotuloDoPerfil(valor: string): string {
  return PERFIS.find((p) => p.valor === valor)?.rotulo ?? valor;
}

/** Iniciais para o avatar (até 2 letras, do nome e do sobrenome). */
export function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0]!.charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1]!.charAt(0) : "";
  return (primeira + ultima).toUpperCase();
}

/** Normaliza o formulário; devolve null quando faltar dado obrigatório. */
export function validarPerfil(entrada: Partial<PerfilUsuario>): PerfilUsuario | null {
  const nome = (entrada.nome ?? "").trim();
  const email = (entrada.email ?? "").trim();
  if (nome.length === 0 || email.length === 0) return null;
  return {
    nome,
    email,
    perfil: entrada.perfil ?? "graduacao",
  };
}

export function carregarPerfil(st?: Armazenamento): PerfilUsuario | null {
  const s = st ?? armazenamentoPadrao();
  if (!s) return null;
  try {
    const cru = s.getItem(CHAVE_PERFIL);
    if (!cru) return null;
    const dados = JSON.parse(cru) as Partial<PerfilUsuario>;
    return validarPerfil(dados);
  } catch {
    return null; // JSON corrompido: trata como ausente, nunca quebra a tela
  }
}

export function salvarPerfil(dados: PerfilUsuario, st?: Armazenamento): void {
  const s = st ?? armazenamentoPadrao();
  if (!s) return;
  try {
    s.setItem(CHAVE_PERFIL, JSON.stringify(dados));
  } catch {
    /* armazenamento indisponível: segue sem persistir */
  }
}
