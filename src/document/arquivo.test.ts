import { describe, expect, test } from "bun:test";
import { extensaoDe, extrairTextoDocx, lerArquivo } from "./arquivo";

/* ---------- montagem de um .docx mínimo (ZIP) para os testes ---------- */

const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

async function comprimir(dados: Uint8Array): Promise<Uint8Array> {
  const entrada = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(new Uint8Array(dados));
      controller.close();
    },
  });
  const fluxo = entrada.pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** ZIP de entrada única (`word/document.xml`), método 0 (stored) ou 8 (deflate). */
async function montarDocx(conteudoXml: string, metodo: 0 | 8): Promise<Uint8Array> {
  const nome = new TextEncoder().encode("word/document.xml");
  const dados = new TextEncoder().encode(conteudoXml);
  const corpo = metodo === 8 ? await comprimir(dados) : dados;

  const local = [
    ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(metodo), ...u16(0), ...u16(0),
    ...u32(0), // CRC não verificado pelo leitor
    ...u32(corpo.length), ...u32(dados.length), ...u16(nome.length), ...u16(0),
  ];
  const cabecalhoLocal = Uint8Array.from([...local, ...nome]);

  const central = [
    ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(metodo), ...u16(0), ...u16(0),
    ...u32(0), ...u32(corpo.length), ...u32(dados.length), ...u16(nome.length),
    ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0), // local offset = 0
  ];
  const entradaCentral = Uint8Array.from([...central, ...nome]);

  const eocd = [
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(1), ...u16(1),
    ...u32(entradaCentral.length), ...u32(cabecalhoLocal.length + corpo.length), ...u16(0),
  ];

  const tudo = new Uint8Array(
    cabecalhoLocal.length + corpo.length + entradaCentral.length + eocd.length,
  );
  tudo.set(cabecalhoLocal, 0);
  tudo.set(corpo, cabecalhoLocal.length);
  tudo.set(entradaCentral, cabecalhoLocal.length + corpo.length);
  tudo.set(Uint8Array.from(eocd), cabecalhoLocal.length + corpo.length + entradaCentral.length);
  return tudo;
}

const XML = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
  "<w:p><w:r><w:t>INTRODUÇÃO</w:t></w:r></w:p>",
  '<w:p><w:r><w:t xml:space="preserve">Texto &amp; acentuação: ção, í, “aspas”.</w:t></w:r></w:p>',
  "<w:p/>",
  "<w:p><w:r><w:t>Parágrafo três.</w:t></w:r></w:p>",
  "</w:body></w:document>",
].join("");

const XML_ESPERADO = "INTRODUÇÃO\n\nTexto & acentuação: ção, í, “aspas”.\n\nParágrafo três.";

/* ---------- testes ---------- */

describe("document/arquivo — extensões", () => {
  test("extensaoDe extrai e normaliza", () => {
    expect(extensaoDe("tese.docx")).toBe("docx");
    expect(extensaoDe("NOTAS.TXT")).toBe("txt");
    expect(extensaoDe("artigo.tar.docx")).toBe("docx");
    expect(extensaoDe("semextensao")).toBe("");
    expect(extensaoDe(".oculto")).toBe("oculto");
  });
});

describe("document/arquivo — leitura de manuscritos", () => {
  test(".txt é lido como UTF-8 e sem BOM", async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Parágrafo de exemplo.")]);
    const r = await lerArquivo({ nome: "texto.txt", bytes });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.texto).toBe("Parágrafo de exemplo.");
  });

  test("arquivo .txt vazio é recusado com motivo", async () => {
    const r = await lerArquivo({ nome: "vazio.txt", bytes: new Uint8Array() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("vazio");
  });

  test(".pdf é recusado com orientação legível (não quebra o fluxo)", async () => {
    const r = await lerArquivo({ nome: "tese.pdf", bytes: new Uint8Array([37, 80, 68, 70]) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain(".pdf");
  });

  test("extensão desconhecida é recusada com a lista de formatos", async () => {
    const r = await lerArquivo({ nome: "imagem.png", bytes: new Uint8Array([1, 2, 3]) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain(".docx");
  });

  test(".docx com ZIP stored (método 0) extrai os parágrafos", async () => {
    const bytes = await montarDocx(XML, 0);
    const r = await lerArquivo({ nome: "tcc.docx", bytes });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.texto).toBe(XML_ESPERADO);
  });

  test(".docx com ZIP deflate (método 8) extrai os parágrafos", async () => {
    const bytes = await montarDocx(XML, 8);
    const r = await lerArquivo({ nome: "dissertacao.docx", bytes });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.texto).toBe(XML_ESPERADO);
  });

  test(".docx corrompido não lança — vira motivo legível", async () => {
    const lixo = new TextEncoder().encode("isto nao é um zip de verdade, só lixo");
    const r = await lerArquivo({ nome: "quebrado.docx", bytes: lixo });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo.length).toBeGreaterThan(0);
  });

  test("extrairTextoDocx lança diretamente para arquivo inválido", async () => {
    await expect(extrairTextoDocx(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).rejects.toThrow();
  });
});
