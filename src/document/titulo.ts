/**
 * Heurística compartilhada de título de seção: parágrafo curto e inteiro em
 * caixa-alta é tratado como provável título. Fonte única do conceito — usada
 * pela importação do manuscrito (marcação de `ehTitulo`) e pelo relatório de
 * conformidade por seções (agrupamento).
 */

/** Parágrafo inteiro em caixa-alta e curto = provável título de seção. */
export function ehTituloDeSecao(texto: string): boolean {
  const compacto = texto.trim();
  if (compacto.length === 0 || compacto.length > 80) return false;
  const letras = compacto.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letras.length === 0) return false;
  const maiusculas = letras.replace(/[^A-ZÀ-ÕÜ]/g, "").length;
  return maiusculas / letras.length >= 0.9;
}
