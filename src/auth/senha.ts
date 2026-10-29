/**
 * Módulo `auth/senha` — regras de criação de senha (RF01, aba "Criar conta").
 * Fonte única do que o cadastro exige: o checklist da tela e a validação no
 * envio leem daqui, então as duas coisas nunca divergem.
 *
 * Só vale para a criação de conta — quem já tem cadastro entra com a senha
 * que escolheu, sem imposição retroativa.
 */

export interface RegraSenha {
  /** Texto curto exibido no checklist do cadastro. */
  rotulo: string;
  /** Se a senha atende a esta regra isoladamente. */
  atende: (senha: string) => boolean;
}

/** Mínimo de 8 caracteres: cobre os demais testos sem depender deles. */
const MINIMO = 8;

/**
 * Letras com acento valem (Á, ç, Õ): o teste é por categoria Unicode, não
 * por alfabeto ASCII. O símbolo é o contrário — tudo que não é letra nem
 * número (`!@#$%&*`, vírgula, emoji…).
 */
const TEM_MAIUSCULA = /\p{Lu}/u;
const TEM_MINUSCULA = /\p{Ll}/u;
const TEM_NUMERO = /[0-9]/;
const TEM_SIMBOLO = /[^\p{L}\p{N}]/u;

export const REGRAS_SENHA: RegraSenha[] = [
  { rotulo: `Pelo menos ${MINIMO} caracteres`, atende: (s) => s.length >= MINIMO },
  { rotulo: "Letra maiúscula (A, B, C…)", atende: (s) => TEM_MAIUSCULA.test(s) },
  { rotulo: "Letra minúscula (a, b, c…)", atende: (s) => TEM_MINUSCULA.test(s) },
  { rotulo: "Número (0, 1, 2…)", atende: (s) => TEM_NUMERO.test(s) },
  { rotulo: "Símbolo (!, @, #…)", atende: (s) => TEM_SIMBOLO.test(s) },
];

/** Rótulos das regras ainda não atendidas; vazio = senha pronta. */
export function faltandoRegras(senha: string): string[] {
  return REGRAS_SENHA.filter((regra) => !regra.atende(senha)).map((regra) => regra.rotulo);
}

/** true quando a senha atende a todas as regras de cadastro. */
export function senhaValida(senha: string): boolean {
  return faltandoRegras(senha).length === 0;
}
