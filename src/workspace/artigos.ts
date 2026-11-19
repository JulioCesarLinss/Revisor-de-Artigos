import {
  armazenamentoPadrao,
  carregarWorkspace,
  limparWorkspace,
  salvarWorkspace,
  validarWorkspace,
  type Armazenamento,
  type EstadoWorkspace,
} from "./armazenamento.js";

/**
 * Artigos do usuário: até LIMITE_ARTIGOS manuscritos guardados, um deles
 * aberto no editor. O aberto também vive na chave do workspace (a fonte
 * imediata do editor e do /historico); ao ler a biblioteca, essa cópia
 * prevalece sobre a guardada aqui, que só é atualizada nas trocas.
 */

export const CHAVE_ARTIGOS = "normareview.artigos";
export const LIMITE_ARTIGOS = 3;

export interface Artigo {
  id: string;
  atualizadoEm: number;
  estado: EstadoWorkspace;
}

/** Sempre com ao menos um artigo, e `ativo` é o id de um deles. */
export interface Biblioteca {
  ativo: string;
  artigos: Artigo[];
}

export const MOTIVO_LIMITE =
  `Você já tem ${LIMITE_ARTIGOS} artigos salvos. Exclua um no Histórico para abrir outro.`;

export function estadoVazio(): EstadoWorkspace {
  return {
    bruto: "",
    textoOriginal: null,
    historico: [],
    formatacao: [],
    diagnostico: null,
    textoDiagnosticado: null,
    arquivo: null,
    nome: null,
  };
}

/** Tamanho máximo do nome dado pelo usuário. */
export const LIMITE_NOME = 80;

let sequencia = 0;
export function novoId(agora = Date.now()): string {
  sequencia += 1;
  return `artigo-${agora.toString(36)}-${sequencia.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function estaVazio(estado: EstadoWorkspace): boolean {
  return estado.bruto.trim().length === 0;
}

/** Nome do artigo: o dado pelo usuário; senão o arquivo anexado; senão a primeira linha do texto. */
export function tituloDoArtigo(estado: Pick<EstadoWorkspace, "bruto" | "arquivo" | "nome">, limite = 60): string {
  const dado = estado.nome?.trim();
  if (dado) return dado;
  const doArquivo = estado.arquivo?.replace(/\.[^.]+$/, "").trim();
  if (doArquivo) return doArquivo;
  const linha = estado.bruto.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (!linha) return "Artigo sem título";
  return linha.length <= limite ? linha : `${linha.slice(0, limite - 1).trimEnd()}…`;
}

function artigoNovo(estado: EstadoWorkspace, agora: number): Artigo {
  return { id: novoId(agora), atualizadoEm: agora, estado };
}

/** Valida a forma lida do storage ou da nuvem; nunca lança. */
export function validarBiblioteca(dados: unknown): Biblioteca | null {
  if (typeof dados !== "object" || dados === null) return null;
  const d = dados as { ativo?: unknown; artigos?: unknown };
  if (!Array.isArray(d.artigos)) return null;
  const artigos: Artigo[] = [];
  for (const item of d.artigos) {
    if (typeof item !== "object" || item === null) continue;
    const a = item as { id?: unknown; atualizadoEm?: unknown; estado?: unknown };
    const estado = validarWorkspace(a.estado);
    if (typeof a.id !== "string" || !estado) continue;
    artigos.push({ id: a.id, atualizadoEm: typeof a.atualizadoEm === "number" ? a.atualizadoEm : 0, estado });
  }
  if (artigos.length === 0) return null;
  const guardados = artigos.slice(0, LIMITE_ARTIGOS);
  const ativo = guardados.some((a) => a.id === d.ativo) ? (d.ativo as string) : guardados[0].id;
  return { ativo, artigos: guardados };
}

export function artigoAtivo(b: Biblioteca): Artigo {
  return b.artigos.find((a) => a.id === b.ativo) ?? b.artigos[0];
}

/** Troca o conteúdo do artigo aberto; a data só muda quando algo mudou. */
export function atualizarAtivo(b: Biblioteca, estado: EstadoWorkspace, agora = Date.now()): Biblioteca {
  const atual = artigoAtivo(b);
  if (JSON.stringify(atual.estado) === JSON.stringify(estado)) return b;
  return { ...b, artigos: b.artigos.map((a) => (a.id === atual.id ? { ...a, estado, atualizadoEm: agora } : a)) };
}

/** Novo artigo aberto no lugar do atual; null quando já há LIMITE_ARTIGOS. */
export function criarArtigo(b: Biblioteca, estado: EstadoWorkspace = estadoVazio(), agora = Date.now()): Biblioteca | null {
  if (b.artigos.length >= LIMITE_ARTIGOS) return null;
  const artigo = artigoNovo(estado, agora);
  return { ativo: artigo.id, artigos: [...b.artigos, artigo] };
}

/** Dá nome a um artigo; vazio volta ao nome automático. A data não muda. */
export function renomearArtigo(b: Biblioteca, id: string, nome: string): Biblioteca {
  const limpo = nome.replace(/\s+/g, " ").trim().slice(0, LIMITE_NOME);
  return {
    ...b,
    artigos: b.artigos.map((a) => (a.id === id ? { ...a, estado: { ...a.estado, nome: limpo || null } } : a)),
  };
}

export function abrirArtigo(b: Biblioteca, id: string): Biblioteca {
  return b.artigos.some((a) => a.id === id) ? { ...b, ativo: id } : b;
}

/**
 * Exclui um artigo. Se era o aberto, abre o mais recente dos que sobram;
 * se não sobra nenhum, começa um artigo vazio.
 */
export function removerArtigo(b: Biblioteca, id: string, agora = Date.now()): Biblioteca {
  const restantes = b.artigos.filter((a) => a.id !== id);
  if (restantes.length === 0) {
    const vazio = artigoNovo(estadoVazio(), agora);
    return { ativo: vazio.id, artigos: [vazio] };
  }
  if (b.ativo !== id) return { ...b, artigos: restantes };
  const recente = restantes.reduce((m, a) => (a.atualizadoEm > m.atualizadoEm ? a : m));
  return { ativo: recente.id, artigos: restantes };
}

/** Artigos ordenados do mais recente para o mais antigo (para listar). */
export function porRecencia(b: Biblioteca): Artigo[] {
  return [...b.artigos].sort((x, y) => y.atualizadoEm - x.atualizadoEm);
}

/**
 * Lê a biblioteca do dispositivo. Sem ela (dados de antes desta versão), o
 * trabalho salvo vira o primeiro artigo; sem nada, começa um artigo vazio.
 */
export function carregarBiblioteca(st?: Armazenamento, agora = Date.now()): Biblioteca {
  const s = st ?? armazenamentoPadrao();
  let lida: Biblioteca | null = null;
  try {
    const cru = s?.getItem(CHAVE_ARTIGOS);
    if (cru) lida = validarBiblioteca(JSON.parse(cru));
  } catch {
    lida = null; // JSON corrompido: tratado como ausente
  }
  const aberto = carregarWorkspace(st);
  if (!lida) {
    // Gravada já na criação: sem isso, cada leitura inventaria um id novo para
    // o mesmo artigo (e a nuvem o gravaria com um id diferente a cada vez).
    const primeiro = artigoNovo(aberto ?? estadoVazio(), agora);
    const nova = { ativo: primeiro.id, artigos: [primeiro] };
    salvarBiblioteca(nova, st);
    return nova;
  }
  return aberto ? atualizarAtivo(lida, aberto, agora) : lida;
}

/** Guarda a biblioteca (sem tocar no artigo aberto do editor). */
export function salvarBiblioteca(b: Biblioteca, st?: Armazenamento): void {
  const s = st ?? armazenamentoPadrao();
  if (!s) return;
  try {
    s.setItem(CHAVE_ARTIGOS, JSON.stringify(b));
  } catch {
    /* armazenamento indisponível: segue sem persistir */
  }
}

/** Guarda a biblioteca e põe o artigo ativo no editor (troca, criação, exclusão). */
export function ativarNoDispositivo(b: Biblioteca, st?: Armazenamento): void {
  salvarBiblioteca(b, st);
  salvarWorkspace(artigoAtivo(b).estado, st);
}

/** Sair da conta: nenhum artigo fica no dispositivo. */
export function limparDispositivo(st?: Armazenamento): void {
  limparWorkspace(st);
  const s = st ?? armazenamentoPadrao();
  try {
    s?.removeItem(CHAVE_ARTIGOS);
  } catch {
    /* ignora */
  }
}
