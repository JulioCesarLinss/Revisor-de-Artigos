import type { AcaoRapida } from "../rules/types";

/**
 * Transformações determinísticas de correção rápida.
 * A decisão de aplicar é sempre do usuário — nunca é inferência de IA.
 */
function transformar(acao: AcaoRapida, paragrafo: string): string {
  switch (acao) {
    case "removerEspacosPontuacao":
      return paragrafo.replace(/\s+([,.;:!?])/g, "$1");
    case "adicionarPontoFinal": {
      const fim = paragrafo.trimEnd();
      return /[.!?…:;]["”»)]?$/.test(fim) ? paragrafo : `${fim}.`;
    }
    case "colapsarEspacos":
      return paragrafo.replace(/[ \t]{2,}/g, " ");
  }
}

/**
 * Aplica a correção ao parágrafo alvo sobre o texto bruto (fonte de verdade).
 * Separadores entre parágrafos são preservados integralmente: nenhuma parte do
 * conteúdo é descartada (critério de aceitação do fluxo básico).
 */
export function aplicarCorrecao(bruto: string, acao: AcaoRapida, paragrafoAlvo: number): string {
  if (paragrafoAlvo < 1) return bruto;

  // Com capture group, split mantém os separadores nas posições ímpares.
  const partes = bruto.split(/(\n\s*\n)/);
  let contador = 0;

  const ajustadas = partes.map((parte, i) => {
    if (i % 2 === 1) return parte; // separador original
    if (parte.trim().length === 0) return parte; // espaço em branco puro
    contador += 1;
    if (contador !== paragrafoAlvo) return parte;
    return transformar(acao, parte);
  });

  return ajustadas.join("");
}
