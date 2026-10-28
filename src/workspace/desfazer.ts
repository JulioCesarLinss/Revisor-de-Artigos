/**
 * Pilha do "Desfazer" — substitui as cópias por etapa. Vive só na memória da
 * tela (não vai para o localStorage nem para o Firestore) e guarda no máximo
 * LIMITE_DESFAZER estados anteriores do texto, então não pesa.
 */

export const LIMITE_DESFAZER = 30;

/** Empilha o texto anterior a uma alteração; descarta o mais antigo no limite. */
export function empilhar(pilha: string[], textoAnterior: string, limite = LIMITE_DESFAZER): string[] {
  if (pilha[pilha.length - 1] === textoAnterior) return pilha; // nada mudou desde o último ponto
  const nova = [...pilha, textoAnterior];
  return nova.length > limite ? nova.slice(nova.length - limite) : nova;
}

/** Tira o último estado: devolve o texto a restaurar e a pilha restante. */
export function desempilhar(pilha: string[]): { texto: string; pilha: string[] } | null {
  if (pilha.length === 0) return null;
  return { texto: pilha[pilha.length - 1], pilha: pilha.slice(0, -1) };
}
