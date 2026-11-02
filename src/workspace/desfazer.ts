/**
 * Pilha do "Desfazer" — substitui as cópias por etapa. Vive só na memória da
 * tela (não vai para o localStorage nem para o Firestore) e guarda no máximo
 * LIMITE_DESFAZER estados anteriores do texto e da formatação, então não pesa.
 */

export const LIMITE_DESFAZER = 30;

/** Empilha o estado anterior a uma alteração; descarta o mais antigo no limite. */
export function empilhar<T>(pilha: T[], anterior: T, limite = LIMITE_DESFAZER): T[] {
  // Nada mudou desde o último ponto: não vira um passo.
  if (pilha.length > 0 && JSON.stringify(pilha[pilha.length - 1]) === JSON.stringify(anterior)) return pilha;
  const nova = [...pilha, anterior];
  return nova.length > limite ? nova.slice(nova.length - limite) : nova;
}

/** Tira o último estado: devolve o que restaurar e a pilha restante. */
export function desempilhar<T>(pilha: T[]): { estado: T; pilha: T[] } | null {
  if (pilha.length === 0) return null;
  return { estado: pilha[pilha.length - 1], pilha: pilha.slice(0, -1) };
}
