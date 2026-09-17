/**
 * Fluxo de revisão guiada (Sprint 4): transforma a ferramenta em processo.
 * Estados do [[Cérebro do Projeto]]: rascunho → revisão → versão final,
 * com histórico versionado internamente (só persistir o que o usuário
 * precisa recuperar ou continuar).
 */

export type EstadoFluxo = "rascunho" | "revisao" | "final";

export const ORDEM_FLUXO: EstadoFluxo[] = ["rascunho", "revisao", "final"];

export const ROTULO_ESTADO: Record<EstadoFluxo, string> = {
  rascunho: "Rascunho",
  revisao: "Revisão",
  final: "Versão final",
};

export interface VersaoSnapshot {
  id: number;
  estado: EstadoFluxo;
  /** Texto bruto do documento neste ponto do fluxo. */
  bruto: string;
  totalProblemas: number;
  quando: string;
}

export interface FeedbackAjudou {
  /** Id da entrada do histórico avaliada. */
  historicoId: number;
  ajudou: boolean;
}

let proximoIdVersao = 1;

export function estadoInicial(): EstadoFluxo {
  return "rascunho";
}

export function proximoEstado(estado: EstadoFluxo): EstadoFluxo | null {
  const i = ORDEM_FLUXO.indexOf(estado);
  return i < ORDEM_FLUXO.length - 1 ? ORDEM_FLUXO[i + 1] : null;
}

/**
 * Registra um snapshot da versão atual: o usuário pode retomar ou comparar
 * qualquer ponto do fluxo. Snapshots são internos e leves (texto + métrica).
 */
export function registrarVersao(
  versoes: VersaoSnapshot[],
  entrada: { estado: EstadoFluxo; bruto: string; totalProblemas: number },
): VersaoSnapshot[] {
  return [
    ...versoes,
    {
      id: proximoIdVersao++,
      ...entrada,
      quando: new Date().toLocaleTimeString("pt-BR"),
    },
  ];
}

/** Versão mais recente de um estado, se existir. */
export function ultimaVersao(versoes: VersaoSnapshot[], estado: EstadoFluxo): VersaoSnapshot | undefined {
  for (let i = versoes.length - 1; i >= 0; i--) {
    if (versoes[i].estado === estado) return versoes[i];
  }
  return undefined;
}
