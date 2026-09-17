import type { SugestaoIA } from "../ai/types";

/**
 * Aplica a sugestão IA substituindo APENAS o parágrafo alvo pelo texto
 * sugerido (possivelmente editado pelo usuário antes de aceitar). Os demais
 * parágrafos e separadores permanecem intactos — rastro e não perda (DC-13).
 */
export function aplicarSugestao(bruto: string, sugestao: SugestaoIA, textoFinal: string): string {
  if (sugestao.paragrafo < 1) return bruto;

  const partes = bruto.split(/(\n\s*\n)/);
  let contador = 0;

  const ajustadas = partes.map((parte, i) => {
    if (i % 2 === 1) return parte;
    if (parte.trim().length === 0) return parte;
    contador += 1;
    if (contador !== sugestao.paragrafo) return parte;
    return textoFinal;
  });

  return ajustadas.join("");
}
