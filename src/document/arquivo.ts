/**
 * Upload de manuscrito — leitura no cliente, sem backend.
 * - .txt / .md: texto puro (UTF-8).
 * - .docx: Office Open XML — o arquivo é um ZIP; extraímos `word/document.xml`
 *   e convertemos as runs de texto em parágrafos, sem dependência externa
 *   (descompressão via `DecompressionStream` nativo).
 * - .pdf: recusado com orientação legível — extrair texto de PDF exige um
 *   parser próprio (fontes/streams codificados), fora deste ciclo.
 * Qualquer falha vira `{ ok: false, motivo }` legível (H9); nada lança.
 */

export type ResultadoUpload =
  | { ok: true; texto: string; extensao: string }
  | { ok: false; motivo: string };

const FORMATOS_TEXTO = ["txt", "md", "markdown"];

export function extensaoDe(nome: string): string {
  const ponto = nome.lastIndexOf(".");
  return ponto >= 0 ? nome.slice(ponto + 1).toLowerCase() : "";
}

export async function lerArquivo(arquivo: { nome: string; bytes: Uint8Array }): Promise<ResultadoUpload> {
  const ext = extensaoDe(arquivo.nome);
  try {
    if (FORMATOS_TEXTO.includes(ext)) {
      const texto = new TextDecoder("utf-8").decode(arquivo.bytes).replace(/^\uFEFF/, "");
      if (texto.trim().length === 0) {
        return { ok: false, motivo: `O arquivo "${arquivo.nome}" está vazio.` };
      }
      return { ok: true, texto, extensao: ext };
    }

    if (ext === "docx") {
      const texto = await extrairTextoDocx(arquivo.bytes);
      if (texto.trim().length === 0) {
        return { ok: false, motivo: `O arquivo "${arquivo.nome}" não contém texto legível.` };
      }
      return { ok: true, texto, extensao: ext };
    }

    if (ext === "pdf") {
      return {
        ok: false,
        motivo:
          "Arquivos .pdf ainda não são suportados — abra o PDF, copie o texto e cole no rascunho, " +
          "ou envie o arquivo .docx/.txt correspondente.",
      };
    }

    return {
      ok: false,
      motivo: ext
        ? `Formato ".${ext}" não suportado — envie .docx, .txt ou .md.`
        : "Arquivo sem extensão reconhecida — envie .docx, .txt ou .md.",
    };
  } catch (erro) {
    return {
      ok: false,
      motivo: `Não foi possível ler "${arquivo.nome}"${
        erro instanceof Error ? `: ${erro.message}` : ". O arquivo pode estar corrompido."
      }`,
    };
  }
}

/* ---------------- leitura do ZIP (Office Open XML) ---------------- */

const SIG_EOCD = 0x06054b50; // End of Central Directory
const SIG_CENTRAL = 0x02014b50; // entrada do diretório central
const SIG_LOCAL = 0x04034b50; // cabeçalho local

function ler16(v: Uint8Array, o: number): number {
  return (v[o] ?? 0) | ((v[o + 1] ?? 0) << 8);
}

function ler32(v: Uint8Array, o: number): number {
  // ZIP usa inteiros little-endian (mesma ordem do ler16).
  return (
    ((v[o] ?? 0) | ((v[o + 1] ?? 0) << 8) | ((v[o + 2] ?? 0) << 16) | ((v[o + 3] ?? 0) << 24)) >>> 0
  );
}

/** Localiza o registro EOCD varrendo do fim (comment do ZIP é variável). */
function acharEOCD(v: Uint8Array): number {
  const limite = Math.max(0, v.length - 22 - 0xffff);
  for (let i = v.length - 22; i >= limite; i--) {
    if (ler32(v, i) === SIG_EOCD) return i;
  }
  return -1;
}

async function inflarRaw(dados: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("ambiente sem suporte a descompressão");
  }
  // ReadableStream direto (sem Blob): chunk tipado como BufferSource, o tipo
  // que o writable nativo do DecompressionStream declara.
  const entrada = new ReadableStream<BufferSource>({
    start(controller) {
      // cópia em buffer ArrayBuffer (tipagem exigida pelo enqueue do DOM)
      controller.enqueue(new Uint8Array(dados));
      controller.close();
    },
  });
  const fluxo = entrada.pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** Extrai o texto do `word/document.xml` de um .docx. Lança em arquivo inválido. */
export async function extrairTextoDocx(bytes: Uint8Array): Promise<string> {
  const eocd = acharEOCD(bytes);
  if (eocd < 0) throw new Error("não é um arquivo ZIP válido");

  const totalEntradas = ler16(bytes, eocd + 10);
  const inicioCD = ler32(bytes, eocd + 16);

  let alvo: { metodo: number; compactado: number; local: number } | null = null;
  let pos = inicioCD;
  for (let i = 0; i < totalEntradas; i++) {
    if (ler32(bytes, pos) !== SIG_CENTRAL) break;
    const metodo = ler16(bytes, pos + 10);
    const compactado = ler32(bytes, pos + 20);
    const nomeLen = ler16(bytes, pos + 28);
    const extraLen = ler16(bytes, pos + 30);
    const comentarioLen = ler16(bytes, pos + 32);
    const local = ler32(bytes, pos + 42);
    const nome = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nomeLen));
    if (nome === "word/document.xml") alvo = { metodo, compactado, local };
    pos += 46 + nomeLen + extraLen + comentarioLen;
  }
  if (!alvo) throw new Error("word/document.xml não encontrado");

  if (ler32(bytes, alvo.local) !== SIG_LOCAL) throw new Error("cabeçalho do documento inválido");
  const nomeLenLocal = ler16(bytes, alvo.local + 26);
  const extraLenLocal = ler16(bytes, alvo.local + 28);
  const inicio = alvo.local + 30 + nomeLenLocal + extraLenLocal;
  const dados = bytes.subarray(inicio, inicio + alvo.compactado);

  // CRC do ZIP não é verificado: extração tolerante ao que o editor gerou.
  const conteudo = alvo.metodo === 0 ? dados : await inflarRaw(dados);
  return xmlParaTexto(new TextDecoder("utf-8").decode(conteudo));
}

/** Converte o XML do documento em parágrafos legíveis. */
function xmlParaTexto(xml: string): string {
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n\n")
    .replace(/<w:p\b[^>]*\/>/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
    .replace(/&amp;/g, "&") // &amp; por último: "&amp;lt;" é texto literal "&lt;"
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
