import type { Intervalo } from "../rules/types.js";

/**
 * Marcas de erro no editor, em posições do texto bruto. Cada marca é
 * independente: mexer em um erro apaga só a marca dele, e as demais seguem
 * no lugar certo mesmo com o texto mudando de tamanho.
 */

/** Ordena e junta as marcas sobrepostas (dois avisos sobre o mesmo trecho). */
export function unirTrechos(trechos: Intervalo[]): Intervalo[] {
  const ordenados = trechos.filter((t) => t.fim > t.inicio).sort((a, b) => a.inicio - b.inicio);
  const unidos: Intervalo[] = [];
  for (const t of ordenados) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && t.inicio < ultimo.fim) ultimo.fim = Math.max(ultimo.fim, t.fim);
    else unidos.push({ ...t });
  }
  return unidos;
}

/**
 * Atualiza as marcas depois de uma alteração do texto: a marca tocada pela
 * alteração some; as que vêm depois dela acompanham o deslocamento.
 */
export function ajustarTrechos(trechos: Intervalo[], antes: string, depois: string): Intervalo[] {
  const limite = Math.min(antes.length, depois.length);
  let inicio = 0;
  while (inicio < limite && antes[inicio] === depois[inicio]) inicio++;
  let sufixo = 0;
  while (sufixo < limite - inicio && antes[antes.length - 1 - sufixo] === depois[depois.length - 1 - sufixo]) sufixo++;

  const fimAlterado = antes.length - sufixo;
  const deslocamento = depois.length - antes.length;
  const ajustados: Intervalo[] = [];
  for (const t of trechos) {
    if (t.fim < inicio) ajustados.push(t); // antes da alteração
    else if (t.inicio >= fimAlterado) ajustados.push({ inicio: t.inicio + deslocamento, fim: t.fim + deslocamento });
    // Nos demais casos a alteração toca a marca, inclusive logo depois dela (o
    // ponto final que faltava): ela some. Logo antes da marca não conta: ao
    // digitar um espaço antes de um espaço, a comparação acusa a mudança no
    // fim da sequência, encostada na marca, sem o usuário ter mexido nela.
  }
  return ajustados;
}

/**
 * Acha um trecho citado pela IA dentro do parágrafo. Só confia no que está
 * mesmo no texto: tolera espaços e maiúsculas diferentes; se não achar, devolve null.
 */
export function localizarTrecho(paragrafo: string, trecho: string | undefined): Intervalo | null {
  if (typeof trecho !== "string" || trecho.trim().length === 0) return null;
  const padrao = trecho
    .trim()
    .split(/\s+/)
    .map((parte) => parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const achado = new RegExp(padrao, "i").exec(paragrafo);
  return achado ? { inicio: achado.index, fim: achado.index + achado[0].length } : null;
}
