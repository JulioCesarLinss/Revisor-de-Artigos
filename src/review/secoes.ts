import type { Manuscrito } from "../document/types";
import type { Problema } from "../rules/types";

/**
 * Relatório de conformidade por seção (Sprint 2): agrupa os problemas por
 * seção detectada e resume a situação de cada uma.
 */

export interface Secao {
  /** Nome da seção detectada (ex.: "Introdução", "Referências", "Corpo do texto"). */
  nome: string;
  /** Parágrafos da seção (números 1-based). */
  paragrafos: number[];
}

/** Parágrafo inteiro em caixa-alta e curto = provável título de seção. */
function ehTituloDeSecao(texto: string): boolean {
  const compacto = texto.trim();
  if (compacto.length === 0 || compacto.length > 80) return false;
  const letras = compacto.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letras.length === 0) return false;
  const maiusculas = letras.replace(/[^A-ZÀ-ÕÜ]/g, "").length;
  return maiusculas / letras.length >= 0.9;
}

const NOMES_CONHECIDOS = [
  "RESUMO",
  "ABSTRACT",
  "INTRODUÇÃO",
  "DESENVOLVIMENTO",
  "METODOLOGIA",
  "RESULTADOS",
  "DISCUSSÃO",
  "CONSIDERAÇÕES FINAIS",
  "REFERÊNCIAS",
];

function nomeDaSecao(texto: string, fallback: string): string {
  const limpo = texto.trim().replace(/[:.]\s*$/, "").toUpperCase();
  const conhecido = NOMES_CONHECIDOS.find((n) => limpo === n || limpo.startsWith(n));
  return conhecido ?? fallback;
}

/**
 * Detecta seções por títulos (parágrafo curto em caixa-alta, preferindo nomes
 * conhecidos de trabalhos acadêmicos). O corpo antes do primeiro título é
 * "Abertura"; o texto sem título dentro do fluxo entra em "Corpo do texto".
 */
export function detectarSecoes(manuscrito: Manuscrito): Secao[] {
  const secoes: Secao[] = [];
  let atual: Secao | null = null;

  for (const p of manuscrito.paragrafos) {
    if (ehTituloDeSecao(p.texto)) {
      atual = { nome: nomeDaSecao(p.texto, p.texto.trim().replace(/[:.]\s*$/, "")), paragrafos: [] };
      secoes.push(atual);
      continue;
    }
    if (!atual) {
      atual = { nome: "Abertura", paragrafos: [] };
      secoes.push(atual);
    }
    atual.paragrafos.push(p.index);
  }

  return secoes;
}

export interface LinhaRelatorio {
  secao: string;
  /** Índices (1-based) dos parágrafos da seção, para navegação ao trecho. */
  indices: number[];
  totalParagrafos: number;
  problemas: number;
  criticos: number;
  advertencias: number;
  observacoes: number;
}

export function relatorioPorSecao(
  manuscrito: Manuscrito,
  problemas: Problema[],
): LinhaRelatorio[] {
  const porIndice = new Map<number, Problema[]>();
  for (const p of problemas) {
    if (p.paragrafo === 0) continue; // problema do documento inteiro
    const lista = porIndice.get(p.paragrafo) ?? [];
    lista.push(p);
    porIndice.set(p.paragrafo, lista);
  }

  return detectarSecoes(manuscrito).map((s) => {
    const todos = s.paragrafos.flatMap((n) => porIndice.get(n) ?? []);
    return {
      secao: s.nome,
      indices: s.paragrafos,
      totalParagrafos: s.paragrafos.length,
      problemas: todos.length,
      criticos: todos.filter((p) => p.severidade === "critico").length,
      advertencias: todos.filter((p) => p.severidade === "advertencia").length,
      observacoes: todos.filter((p) => p.severidade === "observacao").length,
    };
  });
}
