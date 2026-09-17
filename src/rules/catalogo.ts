import type { Manuscrito } from "../document/types";
import { trechoDe, type Problema, type Regra } from "./types";

const LIMITE_CARACTERES_PARAGRAFO = 600;
const MINIMO_CARACTERES_PARA_PONTUACAO_FINAL = 40;
const MINIMO_OCORRENCIAS_CAIXA_ALTA = 4;
const MINIMO_PARAGRAFOS_DOCUMENTO = 3;
const MINIMO_PALAVRAS_CITACAO_LONGA = 20;

const PONTUACAO_FINAL = /[.!?…:;]["”»)]?\s*$/;
/** Citação autor-data sem vírgula: "(Silva 2021)", "(MELLO 2020a)". */
const CITACAO_SEM_VIRGULA = /\([^()]*[A-Za-zÀ-ÿ][^(),]*\s(?:19|20)\d{2}[a-z]?\)/;
/** Citação direta entre aspas. */
const CITACAO_ENTRE_ASPAS = /[“"]([^“”"]+)[”"]/g;
/** Indicação de página: ", p. 12", "p. 12-13". */
const INDICACAO_PAGINA = /\bp\.\s*\d/i;
/** Entrada de referência: SOBRENOME, … no início do parágrafo. */
const ENTRADA_REFERENCIA = /^[A-ZÀ-Ü]{2,}[A-ZÀ-Ü\s.,'’-]*,\s/;
const ANO_PUBLICACAO = /\b(?:19|20)\d{2}\b/;

function problema(
  regra: Regra,
  paragrafo: number,
  detalhe: string,
  trecho: string,
  acao?: Problema["acao"],
): Problema {
  return {
    id: `${regra.id}-p${paragrafo}`,
    regraId: regra.id,
    categoria: regra.categoria,
    severidade: regra.severidade,
    mensagem: `${regra.mensagem} ${detalhe}`.trim(),
    referencia: regra.referencia,
    paragrafo,
    trecho,
    acao,
  };
}

/**
 * Catálogo de regras normativas determinísticas.
 * Cada regra é legível e testável isoladamente, com origem/norma de referência
 * (critério de aceite da Sprint 2). A IA não participa desta avaliação (DC-02).
 */
export const CATALOGO: Regra[] = [
  {
    id: "R001",
    titulo: "Espaço em excesso antes da pontuação",
    severidade: "observacao",
    categoria: "formatacao",
    mensagem: "Há espaço em excesso antes de sinal de pontuação.",
    referencia: "Boas práticas de diagramação de textos acadêmicos",
    avaliar: (m: Manuscrito) =>
      m.paragrafos
        .filter((p) => /\s+[,.;:!?]/.test(p.texto))
        .map((p) =>
          problema(
            CATALOGO[0],
            p.index,
            "Verifique o espaçamento antes dos sinais de pontuação.",
            trechoDe(p.texto),
            "removerEspacosPontuacao",
          ),
        ),
  },
  {
    id: "R002",
    titulo: "Parágrafo muito longo",
    severidade: "observacao",
    categoria: "estrutura",
    mensagem: "O parágrafo excede o tamanho usual de leitura confortável.",
    referencia: "Legibilidade de textos acadêmicos (divisão em parágrafos)",
    avaliar: (m: Manuscrito) =>
      m.paragrafos
        .filter((p) => p.texto.length > LIMITE_CARACTERES_PARAGRAFO)
        .map((p) =>
          problema(
            CATALOGO[1],
            p.index,
            `Considere dividi-lo (${p.texto.length} caracteres).`,
            trechoDe(p.texto),
          ),
        ),
  },
  {
    id: "R003",
    titulo: "Aspas desbalanceadas",
    severidade: "advertencia",
    categoria: "formatacao",
    mensagem: "Há aspas abertas sem fechamento correspondente.",
    referencia: "Convenções tipográficas de citação direta",
    avaliar: (m: Manuscrito) =>
      m.paragrafos
        .filter((p) => {
          const retas = (p.texto.match(/"/g) ?? []).length;
          const abertas = (p.texto.match(/“/g) ?? []).length;
          const fechadas = (p.texto.match(/”/g) ?? []).length;
          return retas % 2 !== 0 || abertas !== fechadas;
        })
        .map((p) =>
          problema(
            CATALOGO[2],
            p.index,
            "Revise a abertura e o fechamento das aspas.",
            trechoDe(p.texto),
          ),
        ),
  },
  {
    id: "R004",
    titulo: "Parágrafo sem pontuação final",
    severidade: "observacao",
    categoria: "formatacao",
    mensagem: "O parágrafo termina sem pontuação.",
    referencia: "Convenções de pontuação de textos acadêmicos",
    avaliar: (m: Manuscrito) =>
      m.paragrafos
        .filter((p) => {
          const fim = p.texto.trimEnd();
          return fim.length >= MINIMO_CARACTERES_PARA_PONTUACAO_FINAL && !PONTUACAO_FINAL.test(fim);
        })
        .map((p) =>
          problema(
            CATALOGO[3],
            p.index,
            "Confirme se a frase termina onde deveria.",
            trechoDe(p.texto),
            "adicionarPontoFinal",
          ),
        ),
  },
  {
    id: "R005",
    titulo: "Caixa-alta em excesso",
    severidade: "advertencia",
    categoria: "formatacao",
    mensagem: "O parágrafo usa muitas palavras em caixa-alta.",
    referencia: "Convenções tipográficas de destaque em textos científicos",
    avaliar: (m: Manuscrito) =>
      m.paragrafos
        .filter((p) => (p.texto.match(/\b[A-ZÀ-Ü]{3,}\b/g) ?? []).length >= MINIMO_OCORRENCIAS_CAIXA_ALTA)
        .map((p) =>
          problema(
            CATALOGO[4],
            p.index,
            "Prefira negrito ou itálico para destaque.",
            trechoDe(p.texto),
          ),
        ),
  },
  {
    id: "R006",
    titulo: "Documento muito curto",
    severidade: "observacao",
    categoria: "estrutura",
    mensagem: "O documento tem poucos parágrafos para uma análise significativa.",
    referencia: "Estrutura básica de trabalhos acadêmicos",
    avaliar: (m: Manuscrito) =>
      m.paragrafos.length < MINIMO_PARAGRAFOS_DOCUMENTO
        ? [
            problema(
              CATALOGO[5],
              0,
              `Encontrados ${m.paragrafos.length} parágrafo(s).`,
              "Documento inteiro",
            ),
          ]
        : [],
  },
  {
    id: "R007",
    titulo: "Ano de citação sem vírgula",
    severidade: "advertencia",
    categoria: "formatacao",
    mensagem: "Citação autor-data sem vírgula antes do ano.",
    referencia: "ABNT NBR 10520:2023 — Citações (sistema autor-data)",
    avaliar: (m: Manuscrito) =>
      m.paragrafos
        .filter((p) => CITACAO_SEM_VIRGULA.test(p.texto))
        .map((p) =>
          problema(
            CATALOGO[6],
            p.index,
            "Use o formato (AUTOR, ano) nas citações autor-data.",
            trechoDe(p.texto),
          ),
        ),
  },
  {
    id: "R008",
    titulo: "Citação direta longa sem página",
    severidade: "observacao",
    categoria: "formatacao",
    mensagem: "Citação direta extensa sem indicação de página.",
    referencia: "ABNT NBR 10520:2023 — Indicação da(s) página(s) citada(s)",
    avaliar: (m: Manuscrito) =>
      m.paragrafos
        .filter((p) => {
          const citacoes = p.texto.match(CITACAO_ENTRE_ASPAS) ?? [];
          const longa = citacoes.some(
            (c) => c.replace(/[“”"]/g, "").trim().split(/\s+/).filter(Boolean).length >= MINIMO_PALAVRAS_CITACAO_LONGA,
          );
          return longa && !INDICACAO_PAGINA.test(p.texto);
        })
        .map((p) =>
          problema(
            CATALOGO[7],
            p.index,
            "Indique a página da fonte citada (ex.: “...”, p. 112).",
            trechoDe(p.texto),
          ),
        ),
  },
  {
    id: "R009",
    titulo: "Entrada de referência sem ano",
    severidade: "advertencia",
    categoria: "estrutura",
    mensagem: "Entrada de referência aparente sem ano de publicação.",
    referencia: "ABNT NBR 6023:2018 — Referências — Elaboração",
    avaliar: (m: Manuscrito) =>
      m.paragrafos
        .filter((p) => ENTRADA_REFERENCIA.test(p.texto.trim()) && !ANO_PUBLICACAO.test(p.texto))
        .map((p) =>
          problema(
            CATALOGO[8],
            p.index,
            "A referência deve incluir o ano de publicação.",
            trechoDe(p.texto),
          ),
        ),
  },
  {
    id: "R010",
    titulo: "Espaço duplo entre palavras",
    severidade: "observacao",
    categoria: "formatacao",
    mensagem: "Há espaços duplicados entre palavras.",
    referencia: "ABNT NBR 14724:2011 — Apresentação de trabalhos acadêmicos",
    avaliar: (m: Manuscrito) =>
      m.paragrafos
        .filter((p) => /\S[ \t]{2,}\S/.test(p.texto))
        .map((p) =>
          problema(
            CATALOGO[9],
            p.index,
            "Revise o espaçamento entre as palavras.",
            trechoDe(p.texto),
            "colapsarEspacos",
          ),
        ),
  },
];
