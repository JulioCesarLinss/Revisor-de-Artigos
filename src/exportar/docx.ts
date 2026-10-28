import { importarTexto } from "../document/importar.js";
import { criarZip } from "./zip.js";

/**
 * Exportação do manuscrito revisado em .docx, com formatação ABNT básica:
 * A4, margens 3 cm (superior/esquerda) e 2 cm (inferior/direita), Times New
 * Roman 12, espaçamento 1,5, texto justificado com recuo de 1,25 cm na
 * primeira linha e títulos (mesma heurística da análise) em negrito.
 * A formatação do Word original não volta: a importação guarda só o texto.
 */

export const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Medidas do Word em twips (1 cm ≈ 567). */
const MARGEM_3CM = 1701;
const MARGEM_2CM = 1134;
const RECUO_1_25CM = 709;
const ESPACO_1_5 = 360; // 240 = simples

/** Escapa para XML e remove caracteres de controle que o Word recusa. */
function escapar(texto: string): string {
  return texto
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Texto de um parágrafo em runs: quebra de linha → <w:br/>, tabulação → <w:tab/>. */
function runs(texto: string, negrito: boolean): string {
  const propriedades = negrito ? "<w:rPr><w:b/><w:bCs/></w:rPr>" : "";
  const conteudo = texto
    .replace(/\r/g, "")
    .split("\n")
    .map((linha) =>
      linha
        .split("\t")
        .map((trecho) => `<w:t xml:space="preserve">${escapar(trecho)}</w:t>`)
        .join("<w:tab/>"),
    )
    .join("<w:br/>");
  return `<w:r>${propriedades}${conteudo}</w:r>`;
}

function paragrafoXml(texto: string, ehTitulo: boolean): string {
  const propriedades = ehTitulo
    ? `<w:pPr><w:keepNext/><w:spacing w:before="${ESPACO_1_5}" w:after="${ESPACO_1_5}" w:line="${ESPACO_1_5}" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>`
    : `<w:pPr><w:spacing w:after="0" w:line="${ESPACO_1_5}" w:lineRule="auto"/><w:ind w:firstLine="${RECUO_1_25CM}"/><w:jc w:val="both"/></w:pPr>`;
  return `<w:p>${propriedades}${runs(texto, ehTitulo)}</w:p>`;
}

const CABECALHO_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const CONTENT_TYPES =
  CABECALHO_XML +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  "</Types>";

const RELS =
  CABECALHO_XML +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

const DOCUMENT_RELS =
  CABECALHO_XML +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  "</Relationships>";

/** Padrão do documento: Times New Roman 12, português do Brasil. */
const STYLES =
  CABECALHO_XML +
  `<w:styles xmlns:w="${NS_W}">` +
  "<w:docDefaults>" +
  '<w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>' +
  '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>' +
  `<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${ESPACO_1_5}" w:lineRule="auto"/></w:pPr></w:pPrDefault>` +
  "</w:docDefaults>" +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  "</w:styles>";

/** Gera os bytes do .docx a partir do texto bruto do editor. */
export function gerarDocx(bruto: string): Uint8Array {
  const paragrafos = importarTexto(bruto).paragrafos;
  const corpo =
    paragrafos.length > 0 ? paragrafos.map((p) => paragrafoXml(p.texto, p.ehTitulo === true)).join("") : "<w:p/>";

  const documento =
    CABECALHO_XML +
    `<w:document xmlns:w="${NS_W}"><w:body>` +
    corpo +
    "<w:sectPr>" +
    '<w:pgSz w:w="11906" w:h="16838"/>' + // A4
    `<w:pgMar w:top="${MARGEM_3CM}" w:right="${MARGEM_2CM}" w:bottom="${MARGEM_2CM}" w:left="${MARGEM_3CM}" w:header="709" w:footer="709" w:gutter="0"/>` +
    "</w:sectPr>" +
    "</w:body></w:document>";

  const texto = new TextEncoder();
  return criarZip([
    { nome: "[Content_Types].xml", dados: texto.encode(CONTENT_TYPES) },
    { nome: "_rels/.rels", dados: texto.encode(RELS) },
    { nome: "word/_rels/document.xml.rels", dados: texto.encode(DOCUMENT_RELS) },
    { nome: "word/document.xml", dados: texto.encode(documento) },
    { nome: "word/styles.xml", dados: texto.encode(STYLES) },
  ]);
}

/** Nome do arquivo exportado: "<nome original>-revisado.docx". */
export function nomeExportado(nomeOriginal: string | null): string {
  const base = (nomeOriginal ?? "").replace(/\.[^.]+$/, "").trim() || "manuscrito";
  return `${base}-revisado.docx`;
}
