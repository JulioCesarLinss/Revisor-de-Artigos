/**
 * Gerador mínimo de ZIP (método STORE, sem compressão) — base do .docx, que
 * é um ZIP de arquivos XML. Sem dependência externa: só o necessário para o
 * Word abrir (cabeçalhos locais, diretório central e registro final).
 * Par do leitor em document/arquivo.ts, que aceita o mesmo formato.
 */

export interface ArquivoZip {
  nome: string;
  dados: Uint8Array;
}

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

/** CRC-32 (o mesmo do ZIP/PNG). */
export function crc32(dados: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Data fixa 01/01/1980 (formato DOS): o arquivo gerado não depende do relógio. */
const DATA_DOS = 0x0021;
const HORA_DOS = 0;
/** Bit 11: nomes em UTF-8. */
const FLAG_UTF8 = 0x0800;

export function criarZip(arquivos: ArquivoZip[]): Uint8Array {
  const codificador = new TextEncoder();
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let deslocamento = 0;

  for (const arquivo of arquivos) {
    const nome = codificador.encode(arquivo.nome);
    const crc = crc32(arquivo.dados);
    const tamanho = arquivo.dados.length;

    const local = new Uint8Array(30 + nome.length + tamanho);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true); // versão necessária
    l.setUint16(6, FLAG_UTF8, true);
    l.setUint16(8, 0, true); // método STORE
    l.setUint16(10, HORA_DOS, true);
    l.setUint16(12, DATA_DOS, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, tamanho, true);
    l.setUint32(22, tamanho, true);
    l.setUint16(26, nome.length, true);
    l.setUint16(28, 0, true); // sem campo extra
    local.set(nome, 30);
    local.set(arquivo.dados, 30 + nome.length);

    const central = new Uint8Array(46 + nome.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true); // versão que criou
    c.setUint16(6, 20, true); // versão necessária
    c.setUint16(8, FLAG_UTF8, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, HORA_DOS, true);
    c.setUint16(14, DATA_DOS, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, tamanho, true);
    c.setUint32(24, tamanho, true);
    c.setUint16(28, nome.length, true);
    // 30: extra, 32: comentário, 34: disco, 36/38: atributos — todos zero
    c.setUint32(42, deslocamento, true);
    central.set(nome, 46);

    locais.push(local);
    centrais.push(central);
    deslocamento += local.length;
  }

  const tamanhoCentral = centrais.reduce((soma, c) => soma + c.length, 0);
  const fim = new Uint8Array(22);
  const f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, arquivos.length, true);
  f.setUint16(10, arquivos.length, true);
  f.setUint32(12, tamanhoCentral, true);
  f.setUint32(16, deslocamento, true);

  const zip = new Uint8Array(deslocamento + tamanhoCentral + fim.length);
  let pos = 0;
  for (const parte of [...locais, ...centrais, fim]) {
    zip.set(parte, pos);
    pos += parte.length;
  }
  return zip;
}
