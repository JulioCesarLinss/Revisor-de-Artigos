import { iniciarRevisao, type AnaliseRevisao, type ResumoRevisao } from "../review/orquestrar";
import { ORDEM_FLUXO, ROTULO_ESTADO, type EstadoFluxo } from "../workspace/fluxo";
import type { Problema } from "../rules/types";
import { tituloDaRegra } from "../ui/rotulos";

/**
 * Módulo `laudo` — tela /laudo (.println do fluxo de revisão guiada).
 * O laudo é uma apuração legível do resultado da análise: data, métricas do
 * documento, resumo por severidade, conformidade por seção e encaminhamento.
 * É report puro, sem IA (DC-02): regras do catálogo são a base normativa.
 */

export interface MetricasDocumento {
  paragrafos: number;
  palavras: number;
  caracteres: number;
}

export interface LinhaLaudableLaudo {
  secao: string;
  totalParagrafos: number;
  problemas: number;
  criticos: number;
  advertencias: number;
  observacoes: number;
}

export interface Laudo {
  geradoEm: Date;
  estadoFluxo: EstadoFluxo;
  metricas: MetricasDocumento;
  resumo: ResumoRevisao;
  /** Conformidade por seção, na ordem das seções do documento. */
  secoes: LinhaLaudableLaudo[];
  /** Somente os problemas com parágrafo atribuído, ordenados pelo documento. */
  achados: Problema[];
  /** Severidade máxima presente (null = documento conforme). */
  maiorSeveridade: "critico" | "advertencia" | "observacao" | null;
}

const ORDEM_SEVERIDADE = { critico: 3, advertencia: 2, observacao: 1 } as const;

/** Veredicto legível em função da severidade máxima presente no laudo. */
export function encaminhamento(l: Pick<Laudo, "maiorSeveridade" | "resumo">): {
  titulo: string;
  texto: string;
} {
  switch (l.maiorSeveridade) {
    case "critico":
      return {
        titulo: "Inconclusivo — correções críticas pendentes",
        texto:
          "Há problemas críticos pendentes de correção antes de novo ciclo de revisão. Revise no editor e regenere este laudo.",
      };
    case "advertencia":
      return {
        titulo: "Advertencial — ajustes recomendados antes da entrega",
        texto:
          "Não há pendências críticas, mas há advertências normativas que merecem ajuste antes da entrega final.",
      };
    case "observacao":
      return {
        titulo: "Quase conformidade — melhorias pontuais indicadas",
        texto: "Apenas observações de melhoria. Ajustes são recomendados, porém não bloqueiam a entrega.",
      };
    default:
      return {
        titulo: "Empregável — documento em conformidade",
        texto: "O documento passou por todas as verificações do catálogo normativo sem pendências.",
      };
  }
}

/** Converte a análise atual no laudo estruturado (puro, sem efeitos). */
export function construirLaudo(
  analise: AnaliseRevisao,
  estadoFluxo: EstadoFluxo = ORDEM_FLUXO[0],
): Laudo {
  const porId = new Map<number, Problema>();
  for (const p of analise.problemas) {
    if (p.paragrafo === 0) continue; // problema do documento inteiro vai ao resumo, não à lista
    porId.set(p.paragrafo, p);
  }

  const achados = [...porId.values()].sort((a, b) => a.paragrafo - b.paragrafo);

  const maior = achados.reduce<"critico" | "advertencia" | "observacao" | null>((maior, p) => {
    if (ORDEM_SEVERIDADE[p.severidade] > ORDEM_SEVERIDADE[maior ?? "observacao"]) return p.severidade;
    return maior;
  }, null);

  return {
    geradoEm: new Date(),
    estadoFluxo,
    metricas: {
      paragrafos: analise.manuscrito.paragrafos.length,
      palavras: analise.manuscrito.totalPalavras,
      caracteres: analise.manuscrito.totalCaracteres,
    },
    resumo: analise.resumo,
    secoes: analise.secoes.map((s) => ({
      secao: s.secao,
      totalParagrafos: s.totalParagrafos,
      problemas: s.problemas,
      criticos: s.criticos,
      advertencias: s.advertencias,
      observacoes: s.observacoes,
    })),
    achados,
    maiorSeveridade: maior,
  };
}

/** Data e hora no padrão legível pt-BR para o cabeçalho do laudo. */
export function rotuloGeradoEm(data: Date): string {
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Texto do laudo em formato de relatório (pronto para copiar). */
export function laudoComoTexto(laudo: Laudo, tituloLaudo = "Laudo NormaReview AI"): string {
  const l: string[] = [];
  const enc = encaminhamento(laudo);

  l.push("=".repeat(64));
  l.push(tituloLaudo.toUpperCase());
  l.push("=".repeat(64));
  l.push("");

  l.push(`Gerado em . . . . . . . ${rotuloGeradoEm(laudo.geradoEm)}`);
  l.push(`Etapa do fluxo . . . . . ${ROTULO_ESTADO[laudo.estadoFluxo]}`);
  const s = laudo.metricas;
  l.push(`Tamanho. . . . . . . . . ${s.paragrafos} parágrafo(s) · ${s.palavras} palavra(s) · ${s.caracteres} caractere(s)`);
  l.push("");

  const r = laudo.resumo;
  l.push("--- RESUMO POR SEVERIDADE --------------------------------------");
  l.push(`Total ...... ${r.total}`);
  l.push(`Críticos ... ${r.criticos}`);
  l.push(`Advertências ${r.advertencias}`);
  l.push(`Observações . ${r.observacoes}`);
  l.push("");

  l.push("--- CONFORMIDADE POR SEÇÃO -------------------------------------");
  if (laudo.secoes.length === 0) {
    l.push("(sem seções detectadas)");
  } else {
    for (const s of laudo.secoes) {
      l.push(
        `${s.secao.padEnd(24)} ${s.totalParagrafos} ¶ · ${s.problemas} prob. (C${s.criticos} / A${s.advertencias} / O${s.observacoes})`,
      );
    }
  }
  l.push("");

  l.push("--- ENCaminhamento ---------------------------------------------");
  l.push(`${enc.titulo}`);
  l.push(`${enc.texto}`);
  l.push("");

  l.push("--- ACHADOS (por parágrafo) ------------------------------------");
  if (laudo.achados.length === 0) {
    l.push("Nenhum problema por parágrafo foi apontado pelo catálogo.");
  } else {
    for (const p of laudo.achados) {
      const titulo = tituloDaRegra(p.regraId) ?? p.regraId;
      l.push(`¶${p.paragrafo} [${p.severidade.toUpperCase()}] ${titulo}`);
      l.push(`    ${p.mensagem}`);
      l.push(`    Ref.: ${p.referencia}`);
      l.push(`    Trecho: “${p.trecho}”`);
      l.push("");
    }
  }

  l.push("=".repeat(64));
  l.push("Laudo gerado automaticamente a partir do catálogo normativo");
  l.push("NormaReview AI — regras normativas como base; IA apenas assistente.");
  l.push("=".repeat(64));

  return l.join("\n");
}

/** Gera o laudo a partir de texto bruto e estado do fluxo (usado pela tela). */
export function gerarLaudo(bruto: string, estadoFluxo: EstadoFluxo): Laudo {
  return construirLaudo(iniciarRevisao(bruto), estadoFluxo);
}
