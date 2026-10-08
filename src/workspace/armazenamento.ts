import { ORDEM_FLUXO, type EstadoFluxo, type VersaoSnapshot } from "./fluxo";
import type { OrigemAlteracao, RegistroAlteracao } from "./historico";

/**
 * Persistência local do workspace de revisão (texto, histórico, versões e
 * feedback) — permite que a tela /historico mostre dados reais e que o
 * rascunho sobreviva à troca de rotas. Sem backend: armazenamento no
 * dispositivo, com storage injetável para os testes.
 */

export type Armazenamento = {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
};

export const CHAVE_WORKSPACE = "normareview.workspace";

export interface EstadoWorkspace {
  bruto: string;
  historico: RegistroAlteracao[];
  versoes: VersaoSnapshot[];
  estadoFluxo: EstadoFluxo;
  feedbacks: Record<number, boolean>;
}

function armazenamentoPadrao(): Armazenamento | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function ehOrigem(v: unknown): v is OrigemAlteracao {
  return v === "manual" || v === "ia";
}

function ehRegistro(v: unknown): v is RegistroAlteracao {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Partial<RegistroAlteracao>;
  return (
    typeof r.id === "number" &&
    ehOrigem(r.origem) &&
    typeof r.descricao === "string" &&
    typeof r.paragrafo === "number" &&
    typeof r.quando === "string"
  );
}

function ehVersao(v: unknown): v is VersaoSnapshot {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Partial<VersaoSnapshot>;
  return (
    typeof s.id === "number" &&
    typeof s.estado === "string" &&
    ORDEM_FLUXO.includes(s.estado as EstadoFluxo) &&
    typeof s.bruto === "string" &&
    typeof s.totalProblemas === "number" &&
    typeof s.quando === "string"
  );
}

/** Valida a forma lida do storage; nunca lança — dado inválido vira null. */
export function validarWorkspace(dados: unknown): EstadoWorkspace | null {
  if (typeof dados !== "object" || dados === null) return null;
  const d = dados as Partial<EstadoWorkspace>;
  if (typeof d.bruto !== "string") return null;
  if (!Array.isArray(d.historico) || !Array.isArray(d.versoes)) return null;
  if (typeof d.estadoFluxo !== "string" || !ORDEM_FLUXO.includes(d.estadoFluxo as EstadoFluxo)) return null;
  if (typeof d.feedbacks !== "object" || d.feedbacks === null) return null;

  const feedbacks: Record<number, boolean> = {};
  for (const [k, v] of Object.entries(d.feedbacks)) {
    const id = Number(k);
    if (Number.isInteger(id) && typeof v === "boolean") feedbacks[id] = v;
  }

  return {
    bruto: d.bruto,
    historico: d.historico.filter(ehRegistro),
    versoes: d.versoes.filter(ehVersao),
    estadoFluxo: d.estadoFluxo as EstadoFluxo,
    feedbacks,
  };
}

export function carregarWorkspace(st?: Armazenamento): EstadoWorkspace | null {
  const s = st ?? armazenamentoPadrao();
  if (!s) return null;
  try {
    const cru = s.getItem(CHAVE_WORKSPACE);
    if (!cru) return null;
    return validarWorkspace(JSON.parse(cru));
  } catch {
    return null; // JSON corrompido: tratado como ausente, nunca quebra a tela
  }
}

export function salvarWorkspace(estado: EstadoWorkspace, st?: Armazenamento): void {
  const s = st ?? armazenamentoPadrao();
  if (!s) return;
  try {
    s.setItem(CHAVE_WORKSPACE, JSON.stringify(estado));
  } catch {
    /* armazenamento indisponível: segue sem persistir */
  }
}

/** Sai da conta: descarta o workspace (o manuscrito não fica no dispositivo). */
export function limparWorkspace(st?: Armazenamento): void {
  const s = st ?? armazenamentoPadrao();
  if (!s) return;
  try {
    s.removeItem(CHAVE_WORKSPACE);
  } catch {
    /* ignora */
  }
}

/**
 * Limpa apenas o rastro (alterações, versões e feedback), preservando o
 * manuscrito e o estado do fluxo — o que a tela /historico oferece.
 */
export function limparHistoricoWorkspace(st?: Armazenamento): EstadoWorkspace | null {
  const atual = carregarWorkspace(st);
  if (!atual) return null;
  const limpo: EstadoWorkspace = { ...atual, historico: [], versoes: [], feedbacks: {} };
  salvarWorkspace(limpo, st);
  return limpo;
}

/** Contagem por origem para o resumo da tela de histórico (DC-13). */
export function contarPorOrigem(historico: RegistroAlteracao[]): {
  manual: number;
  ia: number;
  total: number;
} {
  let manual = 0;
  let ia = 0;
  for (const h of historico) {
    if (h.origem === "ia") ia++;
    else manual++;
  }
  return { manual, ia, total: manual + ia };
}
