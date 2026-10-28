import { describe, expect, test } from "bun:test";
import { extrairTextoDocx } from "../document/arquivo";
import { gerarDocx, nomeExportado } from "./docx";
import { crc32 } from "./zip";

/** Lê um arquivo do ZIP gerado (método STORE) pelo nome. */
function lerDoZip(zip: Uint8Array, nome: string): string | null {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let pos = 0;
  while (pos + 30 <= zip.length && v.getUint32(pos, true) === 0x04034b50) {
    const tamanho = v.getUint32(pos + 18, true);
    const nomeLen = v.getUint16(pos + 26, true);
    const atual = new TextDecoder().decode(zip.subarray(pos + 30, pos + 30 + nomeLen));
    const inicio = pos + 30 + nomeLen;
    if (atual === nome) return new TextDecoder().decode(zip.subarray(inicio, inicio + tamanho));
    pos = inicio + tamanho;
  }
  return null;
}

const MANUSCRITO = [
  "INTRODUÇÃO",
  "Primeiro parágrafo do texto, com acentuação e “aspas curvas”.",
  "Segundo parágrafo com <símbolos> & caracteres especiais\nem duas linhas.",
].join("\n\n");

describe("exportar/docx", () => {
  test("CRC-32 confere com o valor de referência", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  test("ida e volta: o leitor de .docx do app recupera o mesmo texto", async () => {
    const texto = await extrairTextoDocx(gerarDocx(MANUSCRITO));
    expect(texto).toBe(MANUSCRITO);
  });

  test("tem as partes que o Word exige", () => {
    const zip = gerarDocx(MANUSCRITO);
    for (const parte of ["[Content_Types].xml", "_rels/.rels", "word/_rels/document.xml.rels", "word/document.xml", "word/styles.xml"]) {
      expect(lerDoZip(zip, parte)).not.toBeNull();
    }
  });

  test("formatação ABNT básica: margens, fonte, espaçamento, recuo e título em negrito", () => {
    const zip = gerarDocx(MANUSCRITO);
    const documento = lerDoZip(zip, "word/document.xml")!;
    const estilos = lerDoZip(zip, "word/styles.xml")!;

    expect(documento).toContain('w:top="1701"'); // 3 cm
    expect(documento).toContain('w:left="1701"');
    expect(documento).toContain('w:bottom="1134"'); // 2 cm
    expect(documento).toContain('w:right="1134"');
    expect(estilos).toContain('w:ascii="Times New Roman"');
    expect(estilos).toContain('<w:sz w:val="24"/>'); // 12 pt
    expect(documento).toContain('w:line="360"'); // 1,5
    expect(documento).toContain('<w:ind w:firstLine="709"/>'); // 1,25 cm
    expect(documento).toContain('<w:jc w:val="both"/>'); // justificado
    // O título "INTRODUÇÃO" sai em negrito; o corpo, não.
    expect(documento).toMatch(/<w:b\/><w:bCs\/><\/w:rPr><w:t xml:space="preserve">INTRODUÇÃO</);
  });

  test("escapa caracteres especiais e converte quebra de linha", () => {
    const documento = lerDoZip(gerarDocx(MANUSCRITO), "word/document.xml")!;
    expect(documento).toContain("&lt;símbolos&gt; &amp; caracteres");
    expect(documento).toContain("<w:br/>");
  });

  test("texto vazio gera documento válido com um parágrafo vazio", () => {
    const documento = lerDoZip(gerarDocx(""), "word/document.xml")!;
    expect(documento).toContain("<w:p/>");
  });

  test("nome do arquivo exportado", () => {
    expect(nomeExportado("artigo final.docx")).toBe("artigo final-revisado.docx");
    expect(nomeExportado("tese.txt")).toBe("tese-revisado.docx");
    expect(nomeExportado(null)).toBe("manuscrito-revisado.docx");
  });
});
