import type { Intervalo, Problema } from "../rules/types.js";
import { faixaAlterada } from "./destaques.js";
import { posicoesParagrafos, type PosicaoParagrafo } from "./paragrafos.js";

/**
 * Avisos das regras acompanhando a digitação, para o histórico registrar o
 * que o usuário corrigiu digitando. Os avisos não têm identidade entre uma
 * análise e outra (o id muda com o texto): um aviso continua sendo "o mesmo"
 * quando, depois da edição, há outro da mesma regra no mesmo lugar.
 */

export interface AvisoAcompanhado {
  problema: Problema;
  /** Desde quando o aviso está na tela (0 = já estava na análise de partida). */
  desde: number;
}

/**
 * Aviso que some antes disso não entra no histórico: era passageiro,
 * da própria digitação (ex.: o parágrafo ainda sem o ponto final).
 */
export const ESTABELECIDO_MS = 4000;

/** Onde o aviso está no texto (posições absolutas). */
function faixas(p: Problema, paragrafos: PosicaoParagrafo[], tamanho: number): Intervalo[] {
  if (p.paragrafo <= 0) return [{ inicio: 0, fim: tamanho }];
  const base = paragrafos[p.paragrafo - 1];
  if (!base) return [];
  if (p.posicoes && p.posicoes.length > 0) {
    return p.posicoes.map((r) => ({ inicio: base.inicio + r.inicio, fim: base.inicio + r.fim }));
  }
  return [{ inicio: base.inicio, fim: base.fim }];
}

/** Leva a faixa para o texto novo; a faixa tocada pela edição passa a cobrir o que foi escrito. */
function mover(r: Intervalo, faixa: ReturnType<typeof faixaAlterada>, deslocamento: number): Intervalo {
  if (r.fim <= faixa.inicio) return r;
  if (r.inicio >= faixa.fimAntes) return { inicio: r.inicio + deslocamento, fim: r.fim + deslocamento };
  return { inicio: Math.min(r.inicio, faixa.inicio), fim: Math.max(faixa.fimDepois, r.fim + deslocamento) };
}

function encostam(a: Intervalo[], b: Intervalo[]): boolean {
  return a.some((x) => b.some((y) => x.inicio <= y.fim && y.inicio <= x.fim));
}

/**
 * Compara a análise anterior com a nova. Devolve os avisos atuais (com o
 * "desde" herdado de quem continua) e os resolvidos — só os que estavam na
 * tela havia pelo menos `estabelecidoMs`.
 */
export function acompanharAvisos(
  anteriores: AvisoAcompanhado[],
  textoAntes: string,
  problemasDepois: Problema[],
  textoDepois: string,
  agora: number,
  estabelecidoMs: number = ESTABELECIDO_MS,
): { atuais: AvisoAcompanhado[]; resolvidos: Problema[] } {
  const faixa = faixaAlterada(textoAntes, textoDepois);
  const deslocamento = textoDepois.length - textoAntes.length;
  const paragrafosAntes = posicoesParagrafos(textoAntes);
  const paragrafosDepois = posicoesParagrafos(textoDepois);

  const velhos = anteriores.map((a) => ({
    aviso: a,
    onde: faixas(a.problema, paragrafosAntes, textoAntes.length).map((r) => mover(r, faixa, deslocamento)),
    usado: false,
  }));

  const atuais = problemasDepois.map((problema) => {
    const onde = faixas(problema, paragrafosDepois, textoDepois.length);
    const mesmo = velhos.find(
      (v) =>
        !v.usado &&
        v.aviso.problema.regraId === problema.regraId &&
        (problema.paragrafo <= 0 ? v.aviso.problema.paragrafo <= 0 : encostam(v.onde, onde)),
    );
    if (mesmo) mesmo.usado = true;
    return { problema, desde: mesmo ? mesmo.aviso.desde : agora };
  });

  const resolvidos = velhos
    .filter((v) => !v.usado && agora - v.aviso.desde >= estabelecidoMs)
    .map((v) => v.aviso.problema);
  return { atuais, resolvidos };
}
