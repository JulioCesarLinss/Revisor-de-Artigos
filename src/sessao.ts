const CHAVE = "normareview.sessao";

/**
 * Sessão local simulada (sem backend de autenticação): marca apenas que o
 * usuário passou pela tela de login. "Lembrar de mim" persiste no dispositivo
 * (localStorage); caso contrário, a sessão vale só para a aba atual
 * (sessionStorage).
 */
export function sessaoAtiva(): boolean {
  try {
    return sessionStorage.getItem(CHAVE) === "1" || localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

export function iniciarSessao(lembrar: boolean): void {
  try {
    if (lembrar) localStorage.setItem(CHAVE, "1");
    else sessionStorage.setItem(CHAVE, "1");
  } catch {
    /* armazenamento indisponível: sessão apenas em memória */
  }
}

export function encerrarSessao(): void {
  try {
    sessionStorage.removeItem(CHAVE);
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
}
