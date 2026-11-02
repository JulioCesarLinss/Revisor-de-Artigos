import type { Intervalo } from "../rules/types.js";
import { faixaAlterada } from "./destaques.js";

/**
 * Negrito, itálico e sublinhado do manuscrito: faixas de posições sobre o texto
 * bruto, que continua sendo a fonte de verdade — regras e IA leem só o texto.
 */

export type Estilo = "negrito" | "italico" | "sublinhado";

export const ESTILOS: Estilo[] = ["negrito", "italico", "sublinhado"];

export interface TrechoFormatado extends Intervalo {
  estilo: Estilo;
}

/** Ordena e junta as faixas de cada estilo; faixas vazias somem. */
function normalizar(trechos: TrechoFormatado[]): TrechoFormatado[] {
  const unidos: TrechoFormatado[] = [];
  for (const estilo of ESTILOS) {
    const doEstilo = trechos
      .filter((t) => t.estilo === estilo && t.fim > t.inicio)
      .sort((a, b) => a.inicio - b.inicio);
    let ultimo: TrechoFormatado | null = null;
    for (const t of doEstilo) {
      if (ultimo && t.inicio <= ultimo.fim) ultimo.fim = Math.max(ultimo.fim, t.fim);
      else unidos.push((ultimo = { ...t }));
    }
  }
  return unidos;
}

function cobre(trechos: TrechoFormatado[], estilo: Estilo, inicio: number, fim: number): boolean {
  return trechos.some((t) => t.estilo === estilo && t.inicio <= inicio && t.fim >= fim);
}

/** Liga ou desliga um estilo em toda a faixa. */
function definirEstilo(
  trechos: TrechoFormatado[],
  estilo: Estilo,
  inicio: number,
  fim: number,
  ligado: boolean,
): TrechoFormatado[] {
  const resto = trechos.flatMap((t) => {
    if (t.estilo !== estilo || t.fim <= inicio || t.inicio >= fim) return [t];
    return [
      { ...t, fim: inicio },
      { ...t, inicio: fim },
    ];
  });
  return normalizar(ligado ? [...resto, { inicio, fim, estilo }] : resto);
}

/** Botão com texto selecionado: se a seleção toda já tem o estilo, tira; senão, aplica. */
export function alternarEstilo(
  trechos: TrechoFormatado[],
  estilo: Estilo,
  inicio: number,
  fim: number,
): TrechoFormatado[] {
  return definirEstilo(trechos, estilo, inicio, fim, !cobre(trechos, estilo, inicio, fim));
}

/**
 * Estilos que os botões mostram ligados: os da seleção inteira ou, sem seleção,
 * os do caractere antes do cursor (o que se digita ali continua igual a ele).
 */
export function estilosEm(trechos: TrechoFormatado[], inicio: number, fim: number): Estilo[] {
  const de = fim > inicio ? inicio : Math.max(inicio - 1, 0);
  const ate = fim > inicio ? fim : de + 1;
  return ESTILOS.filter((estilo) => cobre(trechos, estilo, de, ate));
}

/**
 * Atualiza as faixas depois de uma alteração do texto: acompanham o
 * deslocamento, e o trecho apagado sai delas. Com `ativos` (digitação), o texto
 * inserido fica com exatamente esses estilos; sem eles (correção, sugestão), só
 * herda o estilo de uma faixa que o envolve.
 */
export function ajustarFormatacao(
  trechos: TrechoFormatado[],
  antes: string,
  depois: string,
  ativos?: Estilo[],
): TrechoFormatado[] {
  if (antes === depois) return trechos;
  const { inicio, fimAntes, fimDepois } = faixaAlterada(antes, depois);
  const deslocamento = depois.length - antes.length;

  let ajustados = trechos.map((t) => ({
    ...t,
    inicio: t.inicio <= inicio ? t.inicio : t.inicio >= fimAntes ? t.inicio + deslocamento : fimDepois,
    fim: t.fim <= inicio ? t.fim : t.fim >= fimAntes ? t.fim + deslocamento : inicio,
  }));
  if (ativos && fimDepois > inicio) {
    for (const estilo of ESTILOS) {
      ajustados = definirEstilo(ajustados, estilo, inicio, fimDepois, ativos.includes(estilo));
    }
  }
  return normalizar(ajustados);
}

/** Pedaço de texto com os mesmos estilos, para desenhar na tela ou exportar. */
export interface ParteFormatada {
  /** Posição do pedaço no texto bruto. */
  inicio: number;
  texto: string;
  estilos: Estilo[];
}

/** Divide um pedaço do texto bruto, que começa em `inicio`, onde os estilos mudam. */
export function partesFormatadas(texto: string, inicio: number, trechos: TrechoFormatado[]): ParteFormatada[] {
  if (texto.length === 0) return [];
  const fim = inicio + texto.length;
  const cortes = new Set([inicio, fim]);
  for (const t of trechos) {
    if (t.inicio > inicio && t.inicio < fim) cortes.add(t.inicio);
    if (t.fim > inicio && t.fim < fim) cortes.add(t.fim);
  }
  const ordenados = [...cortes].sort((a, b) => a - b);
  return ordenados.slice(0, -1).map((de, i) => {
    const ate = ordenados[i + 1];
    return {
      inicio: de,
      texto: texto.slice(de - inicio, ate - inicio),
      estilos: ESTILOS.filter((estilo) => cobre(trechos, estilo, de, ate)),
    };
  });
}
