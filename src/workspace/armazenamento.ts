import type { OrigemAlteracao, RegistroAlteracao } from "./historico";
import type { ResultadoDiagnostico } from "../ai/gemini";

/**
 * Persistência local do workspace de revisão (texto atual, texto original,
 * histórico de alterações e feedback) — permite que a tela /historico mostre
 * dados reais e que o rascunho sobreviva à troca de rotas. Sem backend:
 * armazenamento no dispositivo, com storage injetável para os testes.
 *
 * Sem cópias do texto por etapa: o workspace fica leve (localStorage e o
 * documento do Firestore). Dados antigos com `versoes`/`estadoFluxo` ainda
 * carregam — esses campos são simplesmente ignorados.
 */

export type Armazenamento = {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
};

export const CHAVE_WORKSPACE = "normareview.workspace";

export interface EstadoWorkspace {
  bruto: string;
  /** Texto do arquivo original enviado (null quando nada foi anexado). */
  textoOriginal?: string | null;
  historico: RegistroAlteracao[];
  feedbacks: Record<number, boolean>;
  /**
   * Último diagnóstico do Gemini pedido na tela /revisar. Fica aqui para
   * sobreviver à troca de abas (o componente desmonta ao navegar) até o
   * usuário pedir um novo diagnóstico, carregar outro arquivo ou excluí-lo.
   */
  diagnostico?: ResultadoDiagnostico | null;
  /** Texto que gerou o diagnóstico acima (base do aviso "o texto mudou"). */
  textoDiagnosticado?: string | null;
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

function ehSeveridade(v: unknown): boolean {
  return v === "alta" || v === "media" || v === "baixa";
}

/** Valida a forma de um apontamento do Gemini lido do storage. */
function ehApontamento(v: unknown): boolean {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.paragrafo === "number" &&
    typeof a.categoria === "string" &&
    typeof a.descricao === "string" &&
    typeof a.sugestao === "string" &&
    ehSeveridade(a.severidade)
  );
}

/** Valida a forma do diagnóstico lido do storage; nunca lança. */
function ehDiagnostico(v: unknown): v is ResultadoDiagnostico {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  if (d.ok === false) return typeof d.motivo === "string";
  if (d.ok !== true || typeof d.resumo !== "string" || typeof d.truncado !== "boolean") return false;
  return Array.isArray(d.diagnosticos) && d.diagnosticos.every(ehApontamento);
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

/** Valida a forma lida do storage; nunca lança — dado inválido vira null. */
export function validarWorkspace(dados: unknown): EstadoWorkspace | null {
  if (typeof dados !== "object" || dados === null) return null;
  const d = dados as Partial<EstadoWorkspace>;
  if (typeof d.bruto !== "string") return null;
  if (
    d.textoOriginal !== undefined &&
    d.textoOriginal !== null &&
    typeof d.textoOriginal !== "string"
  )
    return null;
  if (!Array.isArray(d.historico)) return null;
  if (typeof d.feedbacks !== "object" || d.feedbacks === null) return null;

  const feedbacks: Record<number, boolean> = {};
  for (const [k, v] of Object.entries(d.feedbacks)) {
    const id = Number(k);
    if (Number.isInteger(id) && typeof v === "boolean") feedbacks[id] = v;
  }

  // Só os campos atuais: `versoes`/`estadoFluxo` de dados antigos ficam para trás.
  return {
    bruto: d.bruto,
    textoOriginal: d.textoOriginal ?? null,
    historico: d.historico.filter(ehRegistro),
    feedbacks,
    // Diagnóstico malformado é descartado (nunca derruba o manuscrito).
    diagnostico: ehDiagnostico(d.diagnostico) ? d.diagnostico : null,
    textoDiagnosticado: typeof d.textoDiagnosticado === "string" ? d.textoDiagnosticado : null,
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

/** Limpa apenas o rastro (alterações e feedback), preservando o manuscrito. */
export function limparHistoricoWorkspace(st?: Armazenamento): EstadoWorkspace | null {
  const atual = carregarWorkspace(st);
  if (!atual) return null;
  const limpo: EstadoWorkspace = { ...atual, historico: [], feedbacks: {} };
  salvarWorkspace(limpo, st);
  return limpo;
}

/**
 * Volta ao texto original do arquivo enviado: restaura `bruto` e zera o
 * rastro. null quando não há original nem workspace — a tela decide como
 * avisar o usuário.
 */
export function restaurarOriginalWorkspace(st?: Armazenamento): EstadoWorkspace | null {
  const atual = carregarWorkspace(st);
  if (!atual?.textoOriginal) return null;
  const restaurado: EstadoWorkspace = {
    bruto: atual.textoOriginal,
    textoOriginal: atual.textoOriginal,
    historico: [],
    feedbacks: {},
  };
  salvarWorkspace(restaurado, st);
  return restaurado;
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
